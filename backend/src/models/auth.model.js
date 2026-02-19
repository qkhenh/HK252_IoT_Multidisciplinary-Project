const db = require('../libs/db');

/**
 * Tìm user theo username (kèm thông tin role chi tiết)
 * @param {string} username 
 * @returns {Object|null} User object với role details
 */
const findByUsername = async (username) => {
    const query = `
        SELECT 
            u.user_id,
            u.username,
            u.password_hash,
            u.full_name,
            u.email,
            u.role,
            u.avatar_url,
            u.created_at,
            -- Citizen fields
            c.house_id,
            c.phone_number,
            c.identity_card_number,
            c.is_house_owner,
            h.house_number,
            h.block_number,
            hz.zone_id AS citizen_zone_id,
            hz.zone_name AS citizen_zone_name,
            -- Guard fields
            sg.assigned_gate_id,
            sg.employee_code,
            sg.shift_start,
            sg.shift_end,
            g.gate_name AS assigned_gate_name,
            -- Manager fields
            m.managed_zone_id,
            m.department_name,
            mz.zone_name AS managed_zone_name
        FROM users u
        LEFT JOIN citizens c ON u.user_id = c.user_id
        LEFT JOIN houses h ON c.house_id = h.house_id
        LEFT JOIN zones hz ON h.zone_id = hz.zone_id
        LEFT JOIN security_guards sg ON u.user_id = sg.user_id
        LEFT JOIN gates g ON sg.assigned_gate_id = g.gate_id
        LEFT JOIN managers m ON u.user_id = m.user_id
        LEFT JOIN zones mz ON m.managed_zone_id = mz.zone_id
        WHERE u.username = $1
    `;
    
    const result = await db.query(query, [username]);
    
    if (result.rows.length === 0) {
        return null;
    }
    
    const row = result.rows[0];
    
    // Build user object với role-specific data
    const user = {
        user_id: row.user_id,
        username: row.username,
        password_hash: row.password_hash,
        full_name: row.full_name,
        email: row.email,
        role: row.role,
        avatar_url: row.avatar_url,
        created_at: row.created_at,
    };
    
    // Attach role-specific details
    switch (row.role) {
        case 'citizen':
            user.citizen_details = {
                house_id: row.house_id,
                house_number: row.house_number,
                block_number: row.block_number,
                zone_id: row.citizen_zone_id,
                zone_name: row.citizen_zone_name,
                phone_number: row.phone_number,
                identity_card_number: row.identity_card_number,
                is_house_owner: row.is_house_owner,
            };
            break;
        case 'guard':
            user.guard_details = {
                assigned_gate_id: row.assigned_gate_id,
                assigned_gate_name: row.assigned_gate_name,
                employee_code: row.employee_code,
                shift_start: row.shift_start,
                shift_end: row.shift_end,
            };
            break;
        case 'manager':
            user.manager_details = {
                managed_zone_id: row.managed_zone_id,
                managed_zone_name: row.managed_zone_name,
                department_name: row.department_name,
            };
            break;
    }
    
    return user;
};

/**
 * Tìm user theo ID
 * @param {number} userId 
 * @returns {Object|null}
 */
const findById = async (userId) => {
    const query = `
        SELECT 
            u.user_id,
            u.username,
            u.full_name,
            u.email,
            u.role,
            u.avatar_url
        FROM users u
        WHERE u.user_id = $1
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

module.exports = {
    findByUsername,
    findById,
};
