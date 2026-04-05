import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function resetNuclear() {
    console.log('⚠️ INICIANDO PROTOCOLO NUCLEAR: DESTRUCCIÓN DE DATOS Y FOTOS...');
    
    // ==========================================
    // FASE 1: BARRIDO FÍSICO (FOTOS)
    // ==========================================
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    try {
        if (fs.existsSync(uploadsDir)) {
            const archivos = fs.readdirSync(uploadsDir);
            let borrados = 0;
            
            for (const archivo of archivos) {
                // Evitamos borrar carpetas ocultas o archivos del sistema si los hubiera
                if (archivo !== '.gitkeep') { 
                    fs.unlinkSync(path.join(uploadsDir, archivo));
                    borrados++;
                }
            }
            console.log(`🧹 FASE 1 COMPLETADA: ${borrados} foto(s) eliminada(s) físicamente del servidor.`);
        } else {
            console.log('⚠️ La carpeta public/uploads no existe, saltando barrido físico.');
        }
    } catch (err) {
        console.error('❌ Error al intentar borrar las fotos físicas:', err.message);
    }

    // ==========================================
    // FASE 2: BARRIDO LÓGICO (BASE DE DATOS)
    // ==========================================
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            ssl: { rejectUnauthorized: false }
        });

        // Apagamos llaves foráneas para evitar bloqueos
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
        
        const tablas = [
            'comercio', 
            'datos_usuario', 
            'suscripcion_info',
            'suscripcion_pago',
            'reservacion', 
            'pack',      
            'usuario',
            'ganancias_local'
        ];

        for (const tabla of tablas) {
            await connection.execute(`TRUNCATE TABLE ${tabla};`);
        }

        // Encendemos seguridad de nuevo
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1;');

        console.log(`🧹 FASE 2 COMPLETADA: ${tablas.length} tablas vaciadas y IDs reiniciados a 1.`);
        console.log('\n✅ PROTOCOLO EXITOSO: Tu sistema está como recién instalado.');

        await connection.end();

    } catch (error) {
        console.error('❌ Error en la base de datos durante la demolición:', error.message);
    }
}

resetNuclear();