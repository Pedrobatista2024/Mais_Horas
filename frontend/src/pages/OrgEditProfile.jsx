import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import API_BASE_URL from "../config/api";

export default function EditOrgProfile() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    organizationName: "",
    description: "",
    phone: "",
    address: "",
    website: "",
  });

  const [photo, setPhoto] = useState(null); // nova foto (File)
  const [currentPhoto, setCurrentPhoto] = useState(null); // foto salva no backend (path)
  const [preview, setPreview] = useState(null); // preview local
  const [loading, setLoading] = useState(true);

  // ✅ validações
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get("/users/profile");
        const user = response.data.user;
        const profile = user.organizationProfile || {};

        setForm({
          name: user.name || "",
          organizationName: profile.organizationName || "",
          description: profile.description || "",
          phone: profile.phone || "",
          address: profile.address || "",
          website: profile.website || "",
        });

        if (profile.photo) setCurrentPhoto(profile.photo);
      } catch (error) {
        console.error(error);
        alert("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const currentPhotoSrc = useMemo(() => {
    if (!currentPhoto) return "";
    const normalized = String(currentPhoto).replace(/\\/g, "/");
    if (normalized.startsWith("http")) return normalized;
    return `${API_BASE_URL}/${normalized}`;
  }, [currentPhoto]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });

    // limpa erro ao digitar
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    }
    if (errorMessage) setErrorMessage("");
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhoto(file);
    setPreview(URL.createObjectURL(file)); // preview imediato

    if (fieldErrors.photo) setFieldErrors((prev) => ({ ...prev, photo: "" }));
    if (errorMessage) setErrorMessage("");
  }

  function validate() {
    const errors = {};

    // ✅ obrigatórios (exceto website)
    if (!String(form.name || "").trim()) errors.name = "Informe o nome do responsável.";
    if (!String(form.organizationName || "").trim()) errors.organizationName = "Informe o nome da ONG.";
    if (!String(form.phone || "").trim()) errors.phone = "Informe o telefone.";
    if (!String(form.address || "").trim()) errors.address = "Informe o endereço.";
    if (!String(form.description || "").trim()) errors.description = "Informe a descrição.";

    // ✅ foto: obrigatória se não houver foto atual e não selecionou nova
    const hasAnyPhoto = Boolean(preview || photo || currentPhotoSrc);
    if (!hasAnyPhoto) errors.photo = "Envie uma foto da ONG.";

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setErrorMessage("");
    const errors = validate();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setErrorMessage("Preencha os campos obrigatórios antes de salvar.");
      return;
    }

    try {
      const formData = new FormData();

      Object.keys(form).forEach((key) => {
        formData.append(key, form[key]);
      });

      if (photo) formData.append("photo", photo);

      await api.put("/users/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Perfil atualizado com sucesso");
      navigate("/org/profile");
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar perfil");
    }
  }

  if (loading) return <p style={{ padding: 20, color: "#fff" }}>Carregando...</p>;

  return (
    <div style={{ backgroundColor: "#081b3a", minHeight: "100vh" }}>
      {/* ================= NAVBAR ================= */}
      <div
        style={{
          backgroundColor: "#1F3C88",
          color: "#FFFFFF",
          padding: "15px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Mais<span style={{ color: "#27AE60" }}>Horas</span>
        </h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "#FFFFFF",
              padding: "8px 12px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            ← Voltar
          </button>

          <button
            type="button"
            onClick={() => navigate("/org/profile")}
            style={{
              backgroundColor: "#2E5AAC",
              border: "none",
              color: "#FFFFFF",
              padding: "8px 12px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            Ver perfil
          </button>
        </div>
      </div>

      {/* ================= CONTEÚDO ================= */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 40, padding: "0 16px" }}>
        <div style={{ maxWidth: 900, width: "100%", margin: "0 auto" }}>
          {/* Header do Card */}
          <div
            style={{
              backgroundColor: "#1F3C88",
              borderRadius: 12,
              padding: "16px 18px",
              color: "#FFFFFF",
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>
                Editar <span style={{ color: "#27AE60" }}>Perfil da ONG</span>
              </h1>
              <p style={{ margin: "6px 0 0", color: "#DCE6FF", fontSize: 13 }}>
                Campos obrigatórios: tudo, exceto Website.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                padding: "8px 12px",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              ONG
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: 16,
              backgroundColor: "#a1aac9",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 6px 18px rgba(31, 60, 136, 0.12)",
              boxSizing: "border-box",
            }}
          >
            {errorMessage && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  backgroundColor: "#FDECEC",
                  border: "1px solid #F5C6CB",
                  color: "#B42318",
                  borderRadius: 10,
                  fontWeight: 900,
                }}
              >
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Foto atual / preview */}
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                marginBottom: 18,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 14,
                    backgroundColor: "#c8d5ed",
                    border: fieldErrors.photo ? "4px solid #EB5757" : "4px solid #fff",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                  title="Foto da ONG"
                >
                  {preview || currentPhotoSrc ? (
                    <img
                      src={preview ? preview : currentPhotoSrc}
                      alt="Foto da ONG"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ color: "#1F3C88", fontWeight: 900 }}>Sem foto</span>
                  )}
                </div>

                {fieldErrors.photo && (
                  <small style={{ display: "block", marginTop: 6, color: "#B42318", fontWeight: 800 }}>
                    {fieldErrors.photo}
                  </small>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 260 }}>
                <label style={labelStyle}>
                  Foto da ONG (upload) <span style={{ color: "#B42318" }}>*</span>
                </label>
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
                <small style={{ color: "#4F5D75" }}>
                  Se não enviar nova foto, a atual será mantida.
                </small>
              </div>
            </div>

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
                alignItems: "start",
              }}
            >
              <Field
                label="Nome do responsável"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={fieldErrors.name}
                required
              />
              <Field
                label="Nome da ONG"
                name="organizationName"
                value={form.organizationName}
                onChange={handleChange}
                error={fieldErrors.organizationName}
                required
              />
              <Field
                label="Telefone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                error={fieldErrors.phone}
                required
              />
              <Field
                label="Website (opcional)"
                name="website"
                value={form.website}
                onChange={handleChange}
                placeholder="https://..."
                error={fieldErrors.website}
              />
              <Field
                label="Endereço"
                name="address"
                value={form.address}
                onChange={handleChange}
                error={fieldErrors.address}
                required
              />
            </div>

            {/* Descrição */}
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>
                Descrição <span style={{ color: "#B42318" }}>*</span>
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={5}
                style={{
                  ...inputStyle(false, Boolean(fieldErrors.description)),
                  resize: "vertical",
                  color: "#2C3E50",
                }}
                placeholder="Conte sobre a missão da ONG, público atendido, etc..."
              />
              {fieldErrors.description && (
                <small style={{ display: "block", marginTop: 6, color: "#B42318", fontWeight: 800 }}>
                  {fieldErrors.description}
                </small>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button type="submit" style={primaryBtn}>
                Salvar alterações
              </button>

              <button type="button" onClick={() => navigate("/org/profile")} style={secondaryBtn}>
                Cancelar
              </button>
            </div>
          </form>

          <div style={{ height: 28 }} />
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: 6,
  color: "#1F3C88",
  fontWeight: 900,
};

function inputStyle(readOnly, hasError = false) {
  return {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: hasError ? "1px solid #EB5757" : "1px solid #E0E6F1",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: readOnly ? "#F1F3F5" : "#FFFFFF",
    cursor: readOnly ? "not-allowed" : "text",
    color: "#2C3E50",
  };
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  readOnly = false,
  placeholder,
  error,
  required = false,
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: "#B42318" }}>*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        style={inputStyle(readOnly, Boolean(error))}
      />
      {error && (
        <small style={{ display: "block", marginTop: 6, color: "#B42318", fontWeight: 800 }}>
          {error}
        </small>
      )}
    </div>
  );
}

const primaryBtn = {
  backgroundColor: "#27AE60",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};

const secondaryBtn = {
  backgroundColor: "#2E5AAC",
  color: "#FFFFFF",
  border: "none",
  padding: "10px 14px",
  cursor: "pointer",
  borderRadius: 10,
  fontWeight: 900,
};
