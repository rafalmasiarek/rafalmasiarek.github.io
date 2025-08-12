document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  const alertBox = document.getElementById("contact-form-alert");
  const submitBtn = document.getElementById("contact-form-btn");
  const csrfInput = document.getElementById("csrf_token");

  // Ensure all required elements are present
  if (!form || !alertBox || !submitBtn || !csrfInput) return;

  // reCAPTCHA site key: hidden input OR data-attribute (fallback)
  const sitekeyInput = document.getElementById("g-recaptcha-sitekey");
  const sitekey = sitekeyInput?.value || form.dataset.recaptchaSitekey || "";

  // Fetch initial CSRF token
  fetch("/api/csrf/generate")
    .then(res => res.json())
    .then(data => {
      if (data.status === "success" && data.data.csrf_token) {
        csrfInput.value = data.data.csrf_token;
      }
    })
    .catch(err => console.error("CSRF token fetch error:", err));

  async function regenerateToken() {
    try {
      const res = await fetch("/api/csrf/regenerate");
      const json = await res.json();
      if (json.status === "success" && json.data.csrf_token) {
        csrfInput.value = json.data.csrf_token;
        console.log("CSRF token regenerated and updated.");
      }
    } catch (e) {
      console.error("CSRF token regeneration error:", e);
    }
  }

  // Check TTL every 10 seconds, regenerate if less than 30 seconds
  setInterval(async () => {
    try {
      const res = await fetch("/api/csrf/token-expiry");
      const data = await res.json();
      if (data.status === "success" && typeof data.data.ttl === "number") {
        if (data.data.ttl < 30) {
          await regenerateToken();
        }
      }
    } catch (e) {
      console.error("CSRF token expiry check error:", e);
    }
  }, 10000);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      submitBtn.classList.remove("btn-enable-on-input");
      submitBtn.classList.add("btn-disable-on-input");
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> &nbsp; Sending...';

      const formData = new FormData(form);

      // --- reCAPTCHA v3 ---
      async function ensureRecaptcha(timeoutMs = 5000) {
        const start = Date.now();
        while (!(window.grecaptcha && typeof grecaptcha.ready === "function")) {
          if (Date.now() - start > timeoutMs) throw new Error("grecaptcha not loaded");
          await new Promise(r => setTimeout(r, 50));
        }
      }

      if (sitekey) {
        await ensureRecaptcha();
        await new Promise(r => grecaptcha.ready(r));
        const token = await grecaptcha.execute(sitekey, { action: "contactform" });
        formData.set("g-recaptcha-response", token);
      }
      // --- /reCAPTCHA ---

      const response = await fetch("/api/contactform/send", {
        method: "POST",
        body: formData
      });

      const json = await response.json();

      alertBox.classList.remove("alert-green", "alert-red");
      alertBox.textContent = json.message || "Unexpected response.";
      alertBox.classList.add(json.status === "success" ? "alert-green" : "alert-red");
      alertBox.style.display = "block";

      if (json.status === "success") {
        form.reset();
      }
    } catch (err) {
      console.error("Contact form error:", err);
      alertBox.classList.remove("alert-green");
      alertBox.classList.add("alert-red");
      alertBox.textContent = "❌ Unexpected error occurred.";
      alertBox.style.display = "block";
    } finally {
      submitBtn.classList.remove("btn-disable-on-input");
      submitBtn.classList.add("btn-enable-on-input");
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> &nbsp; Send Email';
    }
  });
});
