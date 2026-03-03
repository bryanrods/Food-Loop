document.addEventListener('DOMContentLoaded', () => {
    const registroForm = document.getElementById('registration-form'); // Asegúrate que tu <form> tenga este ID

    if (registroForm) {
        registroForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const datos = {
                nombre: document.getElementById('name').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                plan: document.querySelector('input[name="subscription_plan"]:checked')?.id === 'plan-premium' ? 'premium' : 'basico'
            };

            try {
                // Usamos la URL completa para asegurar que no se pierda
                const respuesta = await fetch('http://localhost:3005/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datos)
                });

                // Si la respuesta no es OK (200-299), lanzamos error
                if (!respuesta.ok) {
                    const textoError = await respuesta.text();
                    console.error('Servidor respondió con error:', textoError);
                    throw new Error('Error en el servidor: ' + respuesta.status);
                }

                const resultado = await respuesta.json();

                if (resultado.success) {
                    alert('¡Suscripción exitosa en Azure!');
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error('Error detallado:', error);
                alert('Hubo un problema. Revisa la consola (F12).');
            }
        });
    }
});