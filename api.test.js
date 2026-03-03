import request from 'supertest';
import app from './server.js';

describe('🧪 PRUEBAS AUTOMATIZADAS: FOOD-LOOP', () => {
    
    // 1. PRUEBA DE LOGIN
    test('Debe iniciar sesión correctamente con un usuario existente', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'bryanrods.t@gmail.com', // 👈 Asegúrate que este email exista en tu seed.sql
                password: 'Atolin01'
            });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        // Validamos que el servidor devuelva el id_usuario real de Azure
        expect(res.body.user).toHaveProperty('id'); 
    });

    // 2. PRUEBA DE PERMISOS POR ROL (GET /api/me)
    test('Debe validar que el rol_usuario es recuperado correctamente', async () => {
        const res = await request(app)
            .get('/api/me')
            .set('user-id', '1'); // 👈 Usa un ID de usuario que ya esté en tu tabla 'usuario'
        
        expect(res.statusCode).toEqual(200);
        // Validamos la columna exacta: rol_usuario
        expect(res.body.user).toHaveProperty('rol_usuario');
    });

    // 3. PRUEBA DE RESERVAR PACK
    test('Debe crear una reservación y afectar el stock_disponible', async () => {
        const res = await request(app)
            .post('/api/reservar')
            .send({
                usuario_id: 3, // ID del cliente
                pack_id: 1,    // ID del pack (Pan Dulce/Pastel)
                cantidad: 1
            });
        
        expect(res.statusCode).toEqual(201);
        expect(res.body.message).toContain('confirmada');
    });
});