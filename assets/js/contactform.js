document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  const alertBox = document.getElementById("contact-form-alert");
  const submitBtn = document.getElementById("contact-form-btn");

  if (!form || !alertBox || !submitBtn) return;

  const siteKey = form.dataset.recaptchaSitekey;

  // Load CSRF token
  fetch("/api/csrf-token")
    .then(res => res.json())
    .then(data => {
      const csrfInput = document.getElementById("csrf_token");
      if (csrfInput && data.status === "success") {
        csrfInput.value = data.data.csrf_token;
      }
    })
    .catch(err => console.error("CSRF token fetch error:", err));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      // Disable submit
      submitBtn.classList.remove("btn-enable-on-input");
      submitBtn.classList.add("btn-disable-on-input");
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> &nbsp; Sending...';

      const formData = new FormData(form);

      // reCAPTCHA v3
      if (siteKey) {
        const token = await grecaptcha.execute(siteKey, { action: "contactform" });
        formData.set("g-recaptcha-response", token);
      }

      // Send form
      const response = await fetch("/api/contactform-send", {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      alertBox.classList.remove("alert-green", "alert-red");
      alertBox.textContent = result.message || "Unexpected response.";
      alertBox.classList.add(result.status === "success" ? "alert-green" : "alert-red");
      alertBox.style.display = "block";

      if (result.status === "success") form.reset();

    } catch (err) {
      console.error("Contact form error:", err);
      alertBox.classList.remove("alert-green");
      alertBox.classList.add("alert-red");
      alertBox.textContent = "❌ Unexpected error occurred.";
      alertBox.style.display = "block";
    } finally {
      // Restore button
      submitBtn.classList.remove("btn-disable-on-input");
      submitBtn.classList.add("btn-enable-on-input");
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> &nbsp; Send Email';
    }
  });
});

