import { query } from "../config/database.js";

const SELECT_FULL = `
  SELECT
    id AS "_id",
    name,
    email,
    password,
    role,
    student_profile AS "studentProfile",
    organization_profile AS "organizationProfile",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM users
`;

const stripPassword = (user) => {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
};

export const User = {
  async findByEmail(email) {
    const { rows } = await query(`${SELECT_FULL} WHERE email = $1`, [email?.toLowerCase()]);
    return rows[0] || null;
  },

  async findById(id, { includePassword = false } = {}) {
    if (!id) return null;
    const { rows } = await query(`${SELECT_FULL} WHERE id = $1`, [id]);
    const user = rows[0] || null;
    return includePassword ? user : stripPassword(user);
  },

  async create({ name, email, password, role = "student" }) {
    const { rows } = await query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id AS "_id", name, email, role,
                 student_profile AS "studentProfile",
                 organization_profile AS "organizationProfile",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, email?.toLowerCase(), password, role]
    );
    return rows[0];
  },

  async updateBasics(id, { name }) {
    if (name === undefined) return;
    await query(`UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`, [name, id]);
  },

  async updateStudentProfile(id, patch) {
    await query(
      `UPDATE users
         SET student_profile = student_profile || $1::jsonb,
             updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(patch), id]
    );
  },

  async updateOrganizationProfile(id, patch) {
    await query(
      `UPDATE users
         SET organization_profile = organization_profile || $1::jsonb,
             updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(patch), id]
    );
  },
};

export default User;
