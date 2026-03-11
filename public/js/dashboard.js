document.addEventListener('DOMContentLoaded', async () => {
    const usuarioGuardado = localStorage.getItem('usuarioFoodLoop');
    
    // 1. Verificación básica: ¿Hay un gafete en el navegador?
    if (!usuarioGuardado) {
        window.location.href = 'login.html';
        return; 
    }

    const usuarioLocal = JSON.parse(usuarioGuardado);

    try {
        // 2. VERIFICACIÓN AVANZADA (GET /me): Le preguntamos a Azure si el gafete es real
        const respuesta = await fetch('http://localhost:3005/api/me', {
            method: 'GET',
            headers: {
                'user-id': usuarioLocal.id // Mandamos el ID oculto en los headers
            }
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            // El servidor confirmó que es real. Ponemos su nombre.
            const saludoElemento = document.getElementById('nombre-usuario');
            if (saludoElemento) {
                saludoElemento.textContent = resultado.user.nombre_usuario;
            }
            
            // ¡AQUÍ ESTÁ LA MAGIA DEL ROL!
            console.log("Rol oficial validado por Azure:", resultado.user.rol_usuario);
            
            // Más adelante usaremos esto para decir: 
            // "Si rol es 'local', muéstrale el botón de 'Publicar Comida'"
            
            // NUEVO CÓDIGO: Lógica de Folio Persistente
            // ==========================================
            // Creamos una clave única usando el ID del usuario para evitar 
            // que distintos usuarios compartan el mismo folio en la misma PC.
            const claveFolioUnico = `folioFoodLoop_${usuarioLocal.id}`;
            let folioUsuario = localStorage.getItem(claveFolioUnico);

            // Si este usuario no tiene un folio guardado, le generamos uno
            if (!folioUsuario) {
                const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let codigo = '';
                for (let i = 0; i < 6; i++) {
                    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
                }
                folioUsuario = 'FL-' + codigo;
                
                // Se guarda permanentemente en su "casillero" personal del navegador
                localStorage.setItem(claveFolioUnico, folioUsuario);
            }

            // Buscamos el elemento en el HTML e inyectamos el folio
            const elementoFolio = document.getElementById('numero-folio');
            if (elementoFolio) {
                elementoFolio.textContent = folioUsuario;
            }            
        } else {
            // Si el servidor dice que es falso o lo borraron de la BD, lo sacamos.
            localStorage.removeItem('usuarioFoodLoop');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Error al validar la sesión con el servidor:", error);
    }
});