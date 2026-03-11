// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';

// // Cargar variables de entorno desde el archivo .env
// dotenv.config();

// async function testConnection() {
//     console.log('⏳ Intentando conectar a la base de datos en Azure...');
    
//     try {
//         const connection = await mysql.createConnection({
//             host: process.env.DB_HOST,
//             port: process.env.DB_PORT,
//             user: process.env.DB_USER,
//             password: process.env.DB_PASS,
//             database: process.env.DB_NAME,
//             ssl: {
//                 rejectUnauthorized: false // Requerido por Azure
//             }
//         });

//         console.log('✅ ¡Conexión exitosa a Azure MySQL!');
//         console.log(`📡 Conectado al host: ${process.env.DB_HOST}`);
        
//         // Hacemos una consulta rápida para ver las tablas y confirmar que hay lectura
//         const [rows] = await connection.execute('SHOW TABLES;');
//         console.log('📂 Tablas encontradas en la base de datos "foodLoop":');
//         console.table(rows);

//         // Cerramos la conexión
//         await connection.end();
//         console.log('🔌 Conexión cerrada correctamente.');

//     } catch (error) {
//         console.error('❌ Error al intentar conectar a la base de datos:');
//         console.error(error.message);
        
//         if (error.code === 'ETIMEDOUT' || error.message.includes('IP address')) {
//             console.log('\n💡 SUGERENCIA: Parece un problema de Firewall. Ve al portal de Azure y asegúrate de que tu dirección IP actual esté permitida en las reglas de red de tu servidor MySQL.');
//         }
//     }
// }

// testConnection();
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function getComercioData() {
    console.log('⏳ Conectando para consultar la tabla "comercio"...');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            ssl: {
                rejectUnauthorized: false 
            }
        });

        // 1. Ejecutamos la consulta para traer todos los registros de la tabla comercio
        // Nota: Asegúrate de que el nombre exacto de la tabla sea 'comercio'
        const [rows] = await connection.execute('SELECT * FROM usuario;');

        if (rows.length === 0) {
            console.log('⚠️ La tabla "usuario" está vacía.');
        } else {
            console.log(`✅ Se encontraron ${rows.length} registros en "usuario":`);
            // console.table es genial para visualizar datos de bases de datos en la terminal
            console.table(rows);
        }

        await connection.end();
        console.log('🔌 Conexión cerrada.');

    } catch (error) {
        console.error('❌ Error al consultar la tabla:');
        console.error(error.message);
    }
}

getComercioData();