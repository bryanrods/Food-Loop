document.addEventListener('DOMContentLoaded', () => {
    // Buscamos el formulario de registro del local
    const formRegistroLocal = document.getElementById('form-registro-local');

    if (formRegistroLocal) {
        formRegistroLocal.addEventListener('submit', async (e) => {
            e.preventDefault(); // Evitamos que la página brinque

            // Sacamos los datos de las cajas de texto
            const nombre = document.getElementById('nombre-local').value;
            const email = document.getElementById('email-local').value;
            const password = document.getElementById('password-local').value;

            try {
                // Le pegamos a la misma ruta de siempre, pero con un detalle extra
                const respuesta = await fetch('http://localhost:3005/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                    nombre: nombre, 
                    email: email, 
                    password: password, 
                    direccion: document.getElementById('address').value, // Agregamos estos 3
                    telefono: document.getElementById('phone').value,
                    categoria: document.getElementById('category').value,
                    plan: 'basico',
                    rol: 'local'
                })
                });

                const resultado = await respuesta.json();

                if (resultado.success) {
                    alert('🏪 ¡Bienvenido a Food-Loop! Tu comercio ha sido registrado con éxito. Por favor inicia sesión.');
                    // Lo mandamos al login para que entre con su nueva cuenta
                    window.location.href = 'login.html'; 
                } else {
                    alert('Error: ' + resultado.message);
                }
            } catch (error) {
                console.error('Error detallado:', error);
                alert('No se pudo conectar con el servidor.');
            }
        });
    }
});