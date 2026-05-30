import { query } from "../config/database.js";

const SELECT_CERT = `
  SELECT
    id AS "_id",
    user_id AS "user",
    activity_id AS "activity",
    participation_id AS "participation",
    hours,
    verification_code AS "verificationCode",
    issued_at AS "issuedAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM certificates
`;

export const Certificate = {
  async findById(id) {
    if (!id) return null;
    const { rows } = await query(`${SELECT_CERT} WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findByIdPopulated(id) {
    const { rows } = await query(
      `SELECT
         c.id AS "_id",
         c.hours,
         c.verification_code AS "verificationCode",
         c.issued_at AS "issuedAt",
         c.created_at AS "createdAt",
         jsonb_build_object(
           '_id', u.id,
           'name', u.name,
           'email', u.email
         ) AS "user",
         jsonb_build_object(
           '_id', a.id,
           'title', a.title,
           'date', a.date,
           'location', a.location,
           'workloadHours', a.workload_hours,
           'createdBy', jsonb_build_object('_id', creator.id, 'name', creator.name)
         ) AS "activity",
         c.participation_id AS "participation"
       FROM certificates c
       JOIN users u ON u.id = c.user_id
       JOIN activities a ON a.id = c.activity_id
       JOIN users creator ON creator.id = a.created_by
       WHERE c.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByCodePopulated(code) {
    const { rows } = await query(
      `SELECT
         c.id AS "_id",
         c.hours,
         c.verification_code AS "verificationCode",
         c.issued_at AS "issuedAt",
         c.created_at AS "createdAt",
         jsonb_build_object(
           '_id', u.id,
           'name', u.name,
           'email', u.email
         ) AS "user",
         jsonb_build_object(
           '_id', a.id,
           'title', a.title,
           'date', a.date,
           'location', a.location,
           'workloadHours', a.workload_hours,
           'createdBy', jsonb_build_object('_id', creator.id, 'name', creator.name)
         ) AS "activity",
         c.participation_id AS "participation"
       FROM certificates c
       JOIN users u ON u.id = c.user_id
       JOIN activities a ON a.id = c.activity_id
       JOIN users creator ON creator.id = a.created_by
       WHERE c.verification_code = $1`,
      [code]
    );
    return rows[0] || null;
  },

  async findByParticipation(participationId) {
    const { rows } = await query(
      `${SELECT_CERT} WHERE participation_id = $1`,
      [participationId]
    );
    return rows[0] || null;
  },

  async findByUserPopulated(userId) {
    const { rows } = await query(
      `SELECT
         c.id AS "_id",
         c.hours,
         c.verification_code AS "verificationCode",
         c.issued_at AS "issuedAt",
         c.created_at AS "createdAt",
         c.user_id AS "user",
         jsonb_build_object(
           '_id', a.id,
           'title', a.title,
           'date', a.date,
           'location', a.location
         ) AS "activity"
       FROM certificates c
       JOIN activities a ON a.id = c.activity_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async create({ userId, activityId, participationId, hours, verificationCode }) {
    const { rows } = await query(
      `INSERT INTO certificates
         (user_id, activity_id, participation_id, hours, verification_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, activityId, participationId, hours, verificationCode]
    );
    return this.findById(rows[0].id);
  },
};

export default Certificate;
