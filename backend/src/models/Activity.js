import { query } from "../config/database.js";

const SELECT_ACTIVITY = `
  SELECT
    id AS "_id",
    title,
    description,
    date,
    start_time AS "startTime",
    end_time AS "endTime",
    location,
    workload_hours AS "workloadHours",
    created_by AS "createdBy",
    min_participants AS "minParticipants",
    max_participants AS "maxParticipants",
    status,
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM activities
`;

export const Activity = {
  async findById(id) {
    if (!id) return null;
    const { rows } = await query(`${SELECT_ACTIVITY} WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findByIdWithCreator(id) {
    const { rows } = await query(
      `SELECT
         a.id AS "_id",
         a.title, a.description, a.date,
         a.start_time AS "startTime",
         a.end_time AS "endTime",
         a.location,
         a.workload_hours AS "workloadHours",
         a.min_participants AS "minParticipants",
         a.max_participants AS "maxParticipants",
         a.status,
         a.created_at AS "createdAt",
         a.updated_at AS "updatedAt",
         jsonb_build_object(
           '_id', u.id,
           'name', u.name,
           'email', u.email
         ) AS "createdBy"
       FROM activities a
       JOIN users u ON u.id = a.created_by
       WHERE a.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findAllWithCreator() {
    const { rows } = await query(
      `SELECT
         a.id AS "_id",
         a.title, a.description, a.date,
         a.start_time AS "startTime",
         a.end_time AS "endTime",
         a.location,
         a.workload_hours AS "workloadHours",
         a.min_participants AS "minParticipants",
         a.max_participants AS "maxParticipants",
         a.status,
         a.created_at AS "createdAt",
         a.updated_at AS "updatedAt",
         jsonb_build_object(
           '_id', u.id,
           'name', u.name,
           'email', u.email
         ) AS "createdBy"
       FROM activities a
       JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC`
    );
    return rows;
  },

  async findByCreator(userId) {
    const { rows } = await query(
      `${SELECT_ACTIVITY} WHERE created_by = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  async countParticipants(activityId) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM participations WHERE activity_id = $1`,
      [activityId]
    );
    return rows[0].count;
  },

  async create(data) {
    const {
      title,
      description,
      date,
      location,
      workloadHours,
      startTime,
      endTime,
      minParticipants = 1,
      maxParticipants = 20,
      createdBy,
      status = "active",
    } = data;

    const { rows } = await query(
      `INSERT INTO activities
         (title, description, date, location, workload_hours,
          start_time, end_time, min_participants, max_participants,
          created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        title,
        description,
        date,
        location,
        workloadHours,
        startTime,
        endTime,
        minParticipants,
        maxParticipants,
        createdBy,
        status,
      ]
    );
    return this.findById(rows[0].id);
  },

  async update(id, patch) {
    const map = {
      title: "title",
      description: "description",
      date: "date",
      location: "location",
      workloadHours: "workload_hours",
      startTime: "start_time",
      endTime: "end_time",
      minParticipants: "min_participants",
      maxParticipants: "max_participants",
      status: "status",
    };
    const sets = [];
    const params = [];
    let i = 1;
    for (const [key, col] of Object.entries(map)) {
      if (patch[key] !== undefined) {
        sets.push(`${col} = $${i++}`);
        params.push(patch[key]);
      }
    }
    if (!sets.length) return this.findById(id);
    params.push(id);
    await query(
      `UPDATE activities SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i}`,
      params
    );
    return this.findById(id);
  },

  async setStatus(id, status) {
    await query(
      `UPDATE activities SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );
  },

  async delete(id) {
    await query(`DELETE FROM activities WHERE id = $1`, [id]);
  },
};

export default Activity;
