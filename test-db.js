import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

async function testConnection() {
    console.log('⏳ Intentando conectar a la base de datos en Azure...');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            ssl: {
                rejectUnauthorized: false // Requerido por Azure
            }
        });

        console.log('✅ ¡Conexión exitosa a Azure MySQL!');
        console.log(`📡 Conectado al host: ${process.env.DB_HOST}`);
        
        // Hacemos una consulta rápida para ver las tablas y confirmar que hay lectura
        const [rows] = await connection.execute('SHOW TABLES;');
        console.log('📂 Tablas encontradas en la base de datos "foodLoop":');
        console.table(rows);

        // Cerramos la conexión
        await connection.end();
        console.log('🔌 Conexión cerrada correctamente.');

    } catch (error) {
        console.error('❌ Error al intentar conectar a la base de datos:');
        console.error(error.message);
        
        if (error.code === 'ETIMEDOUT' || error.message.includes('IP address')) {
            console.log('\n💡 SUGERENCIA: Parece un problema de Firewall. Ve al portal de Azure y asegúrate de que tu dirección IP actual esté permitida en las reglas de red de tu servidor MySQL.');
        }
    }
}

testConnection();