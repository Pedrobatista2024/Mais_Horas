import { query } from "../config/database.js";

const SELECT_PARTICIPATION = `
  SELECT
    id AS "_id",
    activity_id AS "activity",
    user_id AS "user",
    status,
    validated_by AS "validatedBy",
    workload_hours AS "workloadHours",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM participations
`;

export const Participation = {
  async findById(id) {
    if (!id) return null;
    const { rows } = await query(`${SELECT_PARTICIPATION} WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findByActivityAndUser(activityId, userId) {
    const { rows } = await query(
      `${SELECT_PARTICIPATION} WHERE activity_id = $1 AND user_id = $2`,
      [activityId, userId]
    );
    return rows[0] || null;
  },

  async findByActivityWithUser(activityId) {
    const { rows } = await query(
      `SELECT
         p.id AS "_id",
         p.status,
         p.workload_hours AS "workloadHours",
         p.validated_by AS "validatedBy",
         p.created_at AS "createdAt",
         p.updated_at AS "updatedAt",
         jsonb_build_object(
           '_id', u.id,
           'name', u.name,
           'email', u.email
         ) AS "user",
         p.activity_id AS "activity"
       FROM participations p
       JOIN users u ON u.id = p.user_id
       WHERE p.activity_id = $1
       ORDER BY p.created_at ASC`,
      [activityId]
    );
    return rows;
  },

  async findByUserWithActivity(userId) {
    const { rows } = await query(
      `SELECT
         p.id AS "_id",
         p.status,
         p.workload_hours AS "workloadHours",
         p.validated_by AS "validatedBy",
         p.created_at AS "createdAt",
         p.updated_at AS "updatedAt",
         p.user_id AS "user",
         jsonb_build_object(
           '_id', a.id,
           'title', a.title,
           'date', a.date,
           'location', a.location,
           'workloadHours', a.workload_hours
         ) AS "activity"
       FROM participations p
       JOIN activities a ON a.id = p.activity_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async create({ activityId, userId, status = "pending", workloadHours = 0 }) {
    const { rows } = await query(
      `INSERT INTO participations (activity_id, user_id, status, workload_hours)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [activityId, userId, status, workloadHours]
    );
    return this.findById(rows[0].id);
  },

  async updateStatus(id, { status, validatedBy, workloadHours }) {
    const sets = ["status = $1", "updated_at = NOW()"];
    const params = [status];
    let i = 2;
    if (validatedBy !== undefined) {
      sets.push(`validated_by = $${i++}`);
      params.push(validatedBy);
    }
    if (workloadHours !== undefined) {
      sets.push(`workload_hours = $${i++}`);
      params.push(workloadHours);
    }
    params.push(id);
    await query(
      `UPDATE participations SET ${sets.join(", ")} WHERE id = $${i}`,
      params
    );
    return this.findById(id);
  },

  async countPendingByActivity(activityId) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count
         FROM participations
        WHERE activity_id = $1 AND status = 'pending'`,
      [activityId]
    );
    return rows[0].count;
  },

  async findPresentByActivity(activityId) {
    const { rows } = await query(
      `${SELECT_PARTICIPATION} WHERE activity_id = $1 AND status = 'present'`,
      [activityId]
    );
    return rows;
  },

  async deleteByActivity(activityId) {
    await query(`DELETE FROM participations WHERE activity_id = $1`, [activityId]);
  },
};

export default Participation;
