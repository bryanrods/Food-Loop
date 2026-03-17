document.addEventListener('DOMContentLoaded', () => {
    const formRegistroLocal = document.getElementById('form-registro-local');

    if (!formRegistroLocal) return;

    // --- LÓGICA DE VISTA PREVIA DE LA FOTO ---
    const profileInput = document.getElementById('profilePicture');
    const profilePreview = document.getElementById('profilePreview');
    const profileIcon = document.getElementById('profileIcon');

    if (profileInput) {
        profileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    profilePreview.src = event.target.result;
                    profilePreview.style.display = 'block';
                    profileIcon.style.display = 'none';
                }
                reader.readAsDataURL(file);
                document.getElementById('profilePictureError').style.display = 'none';
            }
        });
    }

    // --- RESTRICCIONES FÍSICAS DE TECLADO ---
    const phoneInput = document.getElementById('phone');
    const nombreDuenoInput = document.getElementById('nombre-dueno');
    
    // Bloquear letras en teléfono
    if (phoneInput) {
        phoneInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^[0-9]$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    // Bloquear números y símbolos en nombre del dueño
    if (nombreDuenoInput) {
        nombreDuenoInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', ' ', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^[a-zA-ZÀ-ÿ]$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    // --- VALIDACIÓN INSTANTÁNEA ---
    const validators = {
        'nombre-local': (val) => val.trim().length > 0,
        'nombre-dueno': (val) => val.trim().length > 0 && /^[a-zA-ZÀ-ÿ\s]+$/.test(val),
        'address': (val) => val.trim().length > 5,
        'phone': (val) => val.trim().length === 10 && /^\d{10}$/.test(val),
        'email-local': (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        'password-local': (val) => val.trim().length >= 8,
        'confirm-local': (val) => val === document.getElementById('password-local').value && val.trim() !== ''
    };

    const inputsToValidate = Object.keys(validators);

    inputsToValidate.forEach(id => {
        const el = document.getElementById(id);
        const errEl = document.getElementById(`${id}Error`);
        
        if (el && errEl) {
            el.addEventListener('input', () => {
                if (validators[id](el.value)) {
                    errEl.style.display = 'none';
                    el.classList.remove('input-error');
                } else {
                    errEl.style.display = 'block';
                    el.classList.add('input-error');
                }
            });
        }
    });

    // --- ENVÍO DE DATOS AL SERVIDOR ---
    formRegistroLocal.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        let isFormValid = true; // Asumo que haces tus validaciones aquí

        // Validamos que suban una foto
        if (!profileInput.files.length) {
            document.getElementById('profilePictureError').style.display = 'block';
            isFormValid = false;
        }
        
        //Validamos todos los campos de texto al hacer clic
        inputsToValidate.forEach(id => {
            const el = document.getElementById(id);
            const errEl = document.getElementById(`${id}Error`);
            
            // Si el campo existe, tiene su mensaje de error, y no pasa la validación
            if (el && errEl && !validators[id](el.value)) {
                errEl.style.display = 'block';
                el.classList.add('input-error');
                isFormValid = false;
            }
        });

        if (!isFormValid) return; // Si falla algo, no avanzamos

        // 🛑 LA MAGIA DEL FORMDATA 🛑
        const formData = new FormData();
        formData.append('nombre_usuario', document.getElementById('nombre-dueno').value);
        formData.append('nombre_comercio', document.getElementById('nombre-local').value);
        formData.append('email', document.getElementById('email-local').value);
        formData.append('password', document.getElementById('password-local').value);
        formData.append('direccion', document.getElementById('address').value);
        formData.append('telefono', document.getElementById('phone').value);
        formData.append('rol', 'local');
        
        // Adjuntamos el archivo binario
        formData.append('foto_perfil', profileInput.files[0]);

        try {
            // Fíjate que ya no usamos 'Content-Type': 'application/json'
            // Fetch arma el paquete multiparte automáticamente al detectar FormData
            const respuesta = await fetch('http://localhost:3005/auth/register', {
                method: 'POST',
                body: formData 
            });

            const resultado = await respuesta.json();

            if (resultado.success) {
                Swal.fire({
                    title: '¡Registro Exitoso!',
                    text: resultado.message, // "¡Bienvenido a Food-Loop!..."
                    icon: 'success',
                    confirmButtonColor: '#2D6A4F',
                    confirmButtonText: 'Ir a Iniciar Sesión'
                }).then(() => {
                        window.location.href = 'login.html';
                });
            } else {
                Swal.fire({
                    title: 'No pudimos registrarte',
                    text: resultado.message || ' intentalo de nuevo', 
                    icon: 'warning'
                    });
            }
        } catch (error) {
            console.error('Error de registro:', error);
            Swal.fire({
                    title: 'Error de conexion',
                    text: 'No pudimos conectar con el servidor. Revisa tu internet.',
                    icon: 'error',
                });
        }
    });
});