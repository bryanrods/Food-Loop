document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form'); 

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            const email = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const respuesta = await fetch('http://localhost:3005/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const resultado = await respuesta.json();

                if (resultado.success) {
                    // 1. Guardamos los datos completos (incluyendo el ID y el ROL)
                    localStorage.setItem('usuarioFoodLoop', JSON.stringify(resultado.user));
                    
                    if (resultado.user.rol === 'admin') {
                        Swal.fire({
                            title: 'Centro de Mando',
                            text: 'Bienvenido, Administrador.',
                            icon: 'success',
                            confirmButtonColor: '#1a1a1a', // Un color más oscuro para diferenciarlo
                            timer: 2000,
                            showConfirmButton: false
                        }).then(() =>{
                            window.location.href = 'dashboard-admin.html'; 
                        });
                    }   else if (resultado.user.rol === 'local') {
                        Swal.fire({
                        title: 'Bienvenido, Socio Comercial. Entrando al Panel de Negocios.',
                        text: resultado.message,
                        icon: 'success',
                        confirmButtonColor: '#2D6A4F',
                        timer: 2000, // Se cierra sola en 2 segundos
                        showConfirmButton: false
                        }).then(() =>{
                          window.location.href = 'dashboard-local.html'; //
                        });
                    } else {
                        Swal.fire({
                        title: '¡Hola, ' + resultado.user.nombre + '! Entrando a Food-Loop.',
                        text: resultado.message,
                        icon: 'success',
                        confirmButtonColor: '#2D6A4F',
                        timer: 2000, // Se cierra sola en 2 segundos
                        showConfirmButton: false
                        }).then(() =>{
                          window.location.href = 'dashboard-usuario.html'; //
                        });
                    }
                    
                } else {
                    Swal.fire({
                        title: 'Ups...',
                        text: resultado.message,
                        icon: 'error',
                        confirmButtonColor: '#d32f2f'
                    });
                }
            } catch (error) {
                console.error('Error al conectar:', error);
                Swal.fire({
                    title: 'Error de conexión',
                    text: 'No pudimos conectar con el servidor. Revisa tu internet.',
                    icon: 'error',
                    confirmButtonColor: '#d32f2f'
                });
            }
        });
    }
});