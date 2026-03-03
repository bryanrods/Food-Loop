document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificamos que el usuario haya iniciado sesión
    const usuarioGuardado = localStorage.getItem('usuarioFoodLoop');
    if (!usuarioGuardado) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // 2. Pedimos los packs al servidor
        const respuesta = await fetch('http://localhost:3005/api/packs');
        
        if (!respuesta.ok) {
            throw new Error('Error al conectar con la base de datos');
        }

        const packs = await respuesta.json();
        const contenedor = document.getElementById('contenedor-ofertas');

        // Limpiamos el mensaje de "Buscando..."
        contenedor.innerHTML = ''; 

        if (packs.length === 0) {
            contenedor.innerHTML = '<p>No hay ofertas disponibles en este momento. ¡Vuelve más tarde!</p>';
            return;
        }

        // 3. Dibujamos cada pack que venga de Azure
        packs.forEach(pack => {
            // Usamos los nombres exactos de tus columnas (nombre_pack, descripcion, etc.)
            const tarjeta = `
                <div class="oferta-card">
                    <h3 style="color: #2D6A4F; margin-top: 0;">${pack.nombre_pack}</h3>
                    <p style="color: #555; min-height: 40px;">${pack.descripcion}</p>
                    
                    <div style="margin: 15px 0; display: flex; align-items: center;">
                        <span class="precio-original">$${pack.precio_original}</span>
                        <span class="precio-descuento">$${pack.precio_descuento}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span style="font-size: 0.85em; background: #e9ecef; padding: 4px 8px; border-radius: 4px;">
                            <i class="fas fa-box"></i> Quedan: <strong>${pack.stock_disponible}</strong>
                        </span>
                    </div>
                    
                    <button class="btn btn-primary" style="width: 100%;" onclick="reservarPack(${pack.id_pack})">
                        Reservar Ahora
                    </button>
                </div>
            `;
            contenedor.innerHTML += tarjeta;
        });

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('contenedor-ofertas').innerHTML = 
            '<p style="color: #e63946; text-align: center;">Error al cargar las ofertas. Asegúrate de que tu servidor esté corriendo.</p>';
    }
});

// Función de prueba para el botón "Reservar"
// Función REAL para guardar la reserva en la base de datos
async function reservarPack(idPack) {
    // 1. Sacamos el ID de tu usuario desde su "gafete" de inicio de sesión
    const usuarioGuardado = localStorage.getItem('usuarioFoodLoop');
    if (!usuarioGuardado) {
        alert("Por favor, inicia sesión para reservar.");
        window.location.href = 'login.html';
        return;
    }
    
    const usuario = JSON.parse(usuarioGuardado);

    // 2. Le mandamos la petición al servidor
    try {
        const respuesta = await fetch('http://localhost:3005/api/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario_id: usuario.id, // El ID de Bryan (o quien haya entrado)
                pack_id: idPack,        // El ID del Pan Dulce o el Pastel
                cantidad: 1             // Por ahora reservamos de 1 en 1
            })
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            alert('🎉 ¡Éxito! ' + resultado.message + ' Tu comida está apartada.');
            
            // Recargamos la página mágicamente para que veas cómo bajó el stock
            window.location.reload(); 
        } else {
            alert('Hubo un problema: ' + resultado.message);
        }
    } catch (error) {
        console.error('Error al reservar:', error);
        alert('No se pudo conectar con el servidor.');
    }
}