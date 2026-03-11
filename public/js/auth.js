document.addEventListener('DOMContentLoaded', () => {
    const registroForm = document.getElementById('registration-form'); // Asegúrate que tu <form> tenga este ID

    // --- 1. LÓGICA DE FOTO DE PERFIL ---
    const profileInput = document.getElementById('profilePicture');
    const profilePreview = document.getElementById('profilePreview');
    const profileIcon = document.getElementById('profileIcon');
    const profileError = document.getElementById('profilePictureError');

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
            profileError.style.display = 'none';
        } else {
            profilePreview.style.display = 'none';
            profileIcon.style.display = 'block';
            profileError.style.display = 'block';
        }
    });

    // --- 2. RESTRICCIONES DE TECLADO (Keydown) ---
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');

    // Bloquear números y símbolos en el Nombre
    nameInput.addEventListener('keydown', function(e) {
        // Permitir teclas de control: Backspace, Tab, Enter, Escape, Espacio, Flechas
        const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', ' ', 'ArrowLeft', 'ArrowRight', 'Delete'];
        if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;

        // Expresión regular: Solo letras (incluyendo acentos)
        if (!/^[a-zA-ZÀ-ÿ]$/.test(e.key)) {
            e.preventDefault(); // Bloquea la tecla si no es letra
        }
    });

    // Bloquear letras y símbolos en el Teléfono
    phoneInput.addEventListener('keydown', function(e) {
        // Permitir teclas de control
        const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Delete'];
        if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;

        // Si no es un número del 0 al 9, bloquea
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
        }
    });

    // --- 3. VALIDACIÓN INSTANTÁNEA (Input) ---
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
        
        el.addEventListener('input', () => {
            if (validators[id](el.value)) {
                errEl.style.display = 'none';
                el.classList.remove('input-error');
            } else {
                errEl.style.display = 'block';
                el.classList.add('input-error');
            }
        });
    });


    if (registroForm) {
        registroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            let isValid = true;

            // Validar foto
            if (!profileInput.files.length) {
                profileError.style.display = 'block';
                isValid = false;
            }

            // Validar campos de texto
            inputs.forEach(id => {
                const el = document.getElementById(id);
                const errEl = document.getElementById(`${id}Error`);
                if (!validators[id](el.value)) {
                    errEl.style.display = 'block';
                    el.classList.add('input-error');
                    isValid = false;
                }
            });

            if (!isValid) {
                // Reto: Aquí podrías agregar una pequeña vibración o animación para indicarle al usuario que falló.
                return; 
            }

            // Si todo está correcto, armamos el JSON
            const datos = {
                nombre: nameInput.value,
                edad: parseInt(document.getElementById('age').value),
                telefono: phoneInput.value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value,
                plan: document.querySelector('input[name="subscription_plan"]:checked')?.id === 'plan-premium' ? 'premium' : 'basico'
            };

            try {
                const respuesta = await fetch('http://localhost:3005/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datos)
                });

                if (!respuesta.ok) {
                    const textoError = await respuesta.text();
                    throw new Error(textoError || 'Error en el servidor');
                }

                const resultado = await respuesta.json();

                if (resultado.success) {
                    alert('¡Suscripción exitosa en Azure!');
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error('Error detallado:', error);
                alert('Hubo un problema con el registro. Intenta de nuevo.');
            }
        });
    }
});