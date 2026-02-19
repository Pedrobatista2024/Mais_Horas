import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import API_BASE_URL from "../config/api";

export default function EditStudentProfile() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    sex: "",
    birthDate: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    neighborhood: "",
    institution: "",
    courseName: "",
    aboutMe: "",
    linkedin: "",
    photoUrl: "",
  });

  const [photo, setPhoto] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get("/users/profile");
        const user = response.data.user;

        const profile = user.studentProfile || {};

        setForm({
          fullName: profile.fullName || user.name || "",
          sex: profile.sex || "",
          birthDate: profile.birthDate
            ? String(profile.birthDate).substring(0, 10)
            : "",
          email: user.email || "",
          phone: profile.phone || "",
          city: profile.city || "",
          state: profile.state || "",
          neighborhood: profile.neighborhood || "",
          institution: profile.institution || "",
          courseName: profile.courseName || "",
          aboutMe: profile.aboutMe || "",
          linkedin: profile.linkedin || "",
          photoUrl: profile.photoUrl || "",
        });

        if (profile.photo) setCurrentPhoto(profile.photo);
        if (!profile.photo && profile.photoUrl) setCurrentPhoto(profile.photoUrl);
      } catch (error) {
        console.error(error);
        alert("Erro ao carregar perfil do aluno");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function validateForm() {
    const requiredFields = [
      { key: "fullName", label: "Nome completo" },
      { key: "sex", label: "Sexo" },
      { key: "birthDate", label: "Data de nascimento" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Número para contato" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "Estado/UF" },
      { key: "institution", label: "Instituição de ensino" },
      { key: "courseName", label: "Nome do curso" },
      { key: "aboutMe", label: "Sobre mim" },
      // neighborhood é opcional
      // linkedin é opcional
      // photoUrl é opcional
    ];

    for (const f of requiredFields) {
      const v = String(form[f.key] ?? "").trim();
      if (!v) return `Campo obrigatório: ${f.label}`;
    }

    // ✅ Foto obrigatória: precisa ter foto de upload nova OU já ter uma salva no backend (profile.photo)
    const hasSavedUploadPhoto =
      !!currentPhoto && !String(currentPhoto).startsWith("http"); // path do backend
    const hasNewUploadPhoto = !!photo;

    if (!hasSavedUploadPhoto && !hasNewUploadPhoto) {
      return "Foto de perfil (upload) é obrigatória";
    }

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errorMsg = validateForm();
    if (errorMsg) {
      alert(errorMsg);
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

      alert("Perfil atualizado com sucesso!");
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar perfil");
    }
  }

  if (loading) return <p style={{ padding: 20, color: "#fff" }}>Carregando...</p>;

  return (
    <div style={{ backgroundColor: "#081b3a", minHeight: "100vh", padding: 30 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
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
              Editar <span style={{ color: "#27AE60" }}>Perfil</span>
            </h1>
            <p style={{ margin: "6px 0 0", color: "#DCE6FF", fontSize: 13 }}>
              Atualize seus dados para a ONG te conhecer melhor.
            </p>
          </div>

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
            }}
          >
            ← Voltar
          </button>
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
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: "50%",
                backgroundColor: "#c8d5ed",
                border: "4px solid #fff",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
              title="Foto de perfil"
            >
              {preview || currentPhoto ? (
                <img
                  src={
                    preview
                      ? preview
                      : currentPhoto?.startsWith("http")
                      ? currentPhoto
                      : `${API_BASE_URL}/${String(currentPhoto).replace(/\\/g, "/")}`
                  }
                  alt="Foto do aluno"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ color: "#1F3C88", fontWeight: 900 }}>Foto</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 260 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  color: "#1F3C88",
                  fontWeight: 800,
                }}
              >
                Foto de perfil (upload) <span style={{ color: "#EB5757" }}>*</span>
              </label>
              <input type="file" accept="image/*" onChange={handlePhotoChange} />

              <div style={{ marginTop: 10 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    color: "#1F3C88",
                    fontWeight: 800,
                  }}
                >
                  Foto por URL (opcional)
                </label>
                <input
                  type="text"
                  name="photoUrl"
                  value={form.photoUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                  style={inputStyle(false)}
                />
                <small style={{ color: "#4F5D75" }}>
                  Se você usar URL, pode deixar o upload vazio (mas o upload é obrigatório no
                  primeiro cadastro).
                </small>
              </div>
            </div>
          </div>

          {/* Grid responsivo (não sobrepõe mais) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
              alignItems: "start",
            }}
          >
            <Field
              label="Nome completo *"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
            />

            <Field
              label="Sexo *"
              name="sex"
              type="select"
              value={form.sex}
              onChange={handleChange}
              options={[
                { value: "", label: "Selecione" },
                { value: "male", label: "Masculino" },
                { value: "female", label: "Feminino" },
                { value: "other", label: "Outro" },
                { value: "prefer_not_say", label: "Prefiro não dizer" },
              ]}
            />

            <Field
              label="Data de nascimento *"
              name="birthDate"
              type="date"
              value={form.birthDate}
              onChange={handleChange}
            />

            <Field
              label="Email (login) *"
              name="email"
              value={form.email}
              onChange={handleChange}
              readOnly
            />

            <Field
              label="Número para contato *"
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />

            <Field
              label="LinkedIn (opcional)"
              name="linkedin"
              value={form.linkedin}
              onChange={handleChange}
            />

            <Field label="Cidade *" name="city" value={form.city} onChange={handleChange} />

            <Field
              label="Estado/UF *"
              name="state"
              value={form.state}
              onChange={handleChange}
              placeholder="Ex: CE"
            />

            <Field
              label="Bairro (opcional)"
              name="neighborhood"
              value={form.neighborhood}
              onChange={handleChange}
            />

            <Field
              label="Instituição de ensino *"
              name="institution"
              value={form.institution}
              onChange={handleChange}
            />

            <Field
              label="Nome do curso *"
              name="courseName"
              value={form.courseName}
              onChange={handleChange}
            />
          </div>

          {/* Sobre mim */}
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                color: "#1F3C88",
                fontWeight: 900,
              }}
            >
              Sobre mim <span style={{ color: "#EB5757" }}>*</span>
            </label>
            <textarea
              name="aboutMe"
              value={form.aboutMe}
              onChange={handleChange}
              rows={5}
              style={{
                ...inputStyle(false),
                resize: "vertical",
              }}
              placeholder="Conte um pouco sobre você..."
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button
              type="submit"
              style={{
                backgroundColor: "#27AE60",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 14px",
                cursor: "pointer",
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              Salvar alterações
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                backgroundColor: "#2E5AAC",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 14px",
                cursor: "pointer",
                borderRadius: 10,
                fontWeight: 900,
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function inputStyle(readOnly) {
  return {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #f6f5f5",
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: readOnly ? "#102486" : "#102486",

    // ✅ texto e cursor visíveis
    color: "#ffffff",
    caretColor: "#FFFFFF",

    cursor: readOnly ? "not-allowed" : "text",
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
  options = [],
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={{ display: "block", marginBottom: 6, color: "#1F3C88", fontWeight: 900 }}>
        {label}
      </label>

      {type === "select" ? (
        <select name={name} value={value} onChange={onChange} disabled={readOnly} style={inputStyle(readOnly)}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ color: "#000" }}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          style={inputStyle(readOnly)}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          style={inputStyle(readOnly)}
        />
      )}
    </div>
  );
}
