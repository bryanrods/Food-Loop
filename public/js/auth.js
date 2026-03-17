document.addEventListener('DOMContentLoaded', () => {
    const registroForm = document.getElementById('registration-form');
    if (!registroForm) return;

    // --- 0. LÓGICA DE VISTA PREVIA DE LA FOTO ---
    const profileInputUser = document.getElementById('profilePictureUser');
    const profilePreviewUser = document.getElementById('profilePreviewUser');
    const profileIconUser = document.getElementById('profileIconUser');
    const profileErrorUser = document.getElementById('profilePictureErrorUser');

    if (profileInputUser) {
        profileInputUser.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    if (profilePreviewUser) {
                        profilePreviewUser.src = event.target.result;
                        profilePreviewUser.style.display = 'block';
                    }
                    if (profileIconUser) {
                        profileIconUser.style.display = 'none';
                    }
                }
                reader.readAsDataURL(file);
                if (profileErrorUser) profileErrorUser.style.display = 'none';
            }
        });
    }

    // --- 1. RESTRICCIONES DE TECLADO (Keydown) ---
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');

    if (nameInput) {
        nameInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', ' ', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^[a-zA-ZÀ-ÿ]$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    if (phoneInput) {
        phoneInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^[0-9]$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    // --- 2. VALIDACIÓN INSTANTÁNEA (Input) ---
    const validators = {
        name: (val) => val.trim().length > 0 && /^[a-zA-ZÀ-ÿ\s]+$/.test(val),
        age: (val) => val.trim() !== '' && parseInt(val) >= 18,
        phone: (val) => val.trim().length === 10 && /^\d{10}$/.test(val),
        email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        password: (val) => val.trim().length >= 8,
        confirm: (val) => val === document.getElementById('password').value && val.trim() !== ''
    };

    const inputs = ['name', 'age', 'phone', 'email', 'password', 'confirm'];

    inputs.forEach(id => {
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

    // --- 3. ENVÍO DEL FORMULARIO ---
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let isValid = true;

        // Validar campos de texto
        inputs.forEach(id => {
            const el = document.getElementById(id);
            const errEl = document.getElementById(`${id}Error`);
            if (el && errEl && !validators[id](el.value)) {
                errEl.style.display = 'block';
                el.classList.add('input-error');
                isValid = false;
            }
        });

        // Validar que se haya subido una foto
        if (profileInputUser && !profileInputUser.files.length) {
            if (profileErrorUser) profileErrorUser.style.display = 'block';
            isValid = false;
        }

        if (!isValid) return;

        // 🛑 LA MAGIA DEL FORMDATA (Adiós JSON) 🛑
        const formData = new FormData();
        formData.append('nombre', nameInput.value);
        formData.append('edad', parseInt(document.getElementById('age').value));
        formData.append('telefono', phoneInput.value);
        formData.append('email', document.getElementById('email').value);
        formData.append('password', document.getElementById('password').value);
        formData.append('plan', document.querySelector('input[name="subscription_plan"]:checked')?.id === 'plan-premium' ? 'premium' : 'basico');
        formData.append('rol', 'usuario');

        // Adjuntamos el archivo binario
        if (profileInputUser && profileInputUser.files.length > 0) {
            formData.append('foto_perfil', profileInputUser.files[0]);
        }

        try {
            // Ya no mandamos headers de 'application/json'
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
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = 'login.html';
                    }
                });
            } else {
                Swal.fire({
                    title: 'No pudimos registrarte',
                    text: resultado.message, 
                    icon: 'warning',
                    confirmButtonColor: '#d32f2f'
                });
            }
        } catch (error) {
            console.error("Error al registrar:", error);
                Swal.fire({
                    title: 'Error de conexion',
                    text: 'No es posible registrar con el servidor. Revisa tu internet.',
                    icon: 'error',
                    confirmButtonColor: '#d32f2f'
                });
        }
    });
});