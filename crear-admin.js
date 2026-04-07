import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function crearAdmin() {
    // Nos conectamos directo a Azure usando tus credenciales del .env
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'foodloop-db-v2.mysql.database.azure.com',
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const emailAdmin = 'admin@foodloop.com';
        const passwordPlana = 'admin123'; // 🛑 CAMBIA ESTO por una contraseña real

        // 1. Revisamos si cometiste el error de intentar crearlo dos veces
        const [existe] = await pool.query('SELECT id_usuario FROM usuario WHERE email_usuario = ?', [emailAdmin]);

        if (existe.length > 0) {
            console.log('⚠️ El usuario ya existe en la base de datos.');
            console.log('Ejecutando tu UPDATE para forzar sus permisos a admin...');
            await pool.query("UPDATE usuario SET rol_usuario = 'admin' WHERE email_usuario = ?", [emailAdmin]);
            console.log('✅ ¡Permisos actualizados con éxito!');
        } else {
            console.log('⏳ Creando la cuenta maestra desde cero...');
            
            // 2. Encriptamos la contraseña para que el login no te rechace
            const salt = await bcrypt.genSalt(10);
            const hashedPwd = await bcrypt.hash(passwordPlana, salt);

            // 3. Insertamos el perfil ligero (sin foto, sin datos_usuario, sin suscripción)
            await pool.query(
                "INSERT INTO usuario (nombre_usuario, pswrd_usuario, email_usuario, fecha_creacion, rol_usuario) VALUES ('Administrador FoodLoop', ?, ?, CURDATE(), 'admin')",
                [hashedPwd, emailAdmin]
            );
            console.log('✅ ¡Cuenta de administrador creada y blindada con éxito!');
        }
    } catch (error) {
        console.error('❌ Error inyectando al administrador:', error.message);
    } finally {
        process.exit(); // Apagamos el script para que no se quede colgado en la terminal
    }
}

crearAdmin();