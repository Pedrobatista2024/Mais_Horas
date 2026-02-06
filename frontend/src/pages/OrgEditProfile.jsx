import { useEffect, useState } from "react";
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

  const [photo, setPhoto] = useState(null);          // nova foto (File)
  const [currentPhoto, setCurrentPhoto] = useState(null); // foto salva no backend
  const [preview, setPreview] = useState(null);      // preview local
  const [loading, setLoading] = useState(true);

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

        if (profile.photo) {
          setCurrentPhoto(profile.photo);
        }
      } catch (error) {
        console.error(error);
        alert("Erro ao carregar perfil");
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
    setPreview(URL.createObjectURL(file)); // preview imediato
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const formData = new FormData();

      Object.keys(form).forEach((key) => {
        formData.append(key, form[key]);
      });

      if (photo) {
        formData.append("photo", photo);
      }

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

  if (loading) return <p style={{ color: "#fff" }}>Carregando...</p>;

  return (
    <div
      style={{
        padding: "40px",
        minHeight: "100vh",
        backgroundColor: "#1f1f1f",
        color: "#fff",
      }}
    >
      <h1>Editar Perfil da ONG</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: "600px",
          marginTop: "20px",
          backgroundColor: "#2a2a2a",
          padding: "24px",
          borderRadius: "8px",
        }}
      >
        {[
          { label: "Nome do responsável", name: "name" },
          { label: "Nome da ONG", name: "organizationName" },
          { label: "Descrição", name: "description" },
          { label: "Telefone", name: "phone" },
          { label: "Endereço", name: "address" },
          { label: "Website", name: "website" },
        ].map((field) => (
          <div key={field.name} style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px" }}>
              {field.label}
            </label>
            <input
              type="text"
              name={field.name}
              value={form[field.name]}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "none",
              }}
            />
          </div>
        ))}

        {/* FOTO ATUAL (backend) */}
        {currentPhoto && !preview && (
          <div style={{ marginBottom: "16px" }}>
            <p>Foto atual:</p>
            <img
              src={`${API_BASE_URL}/${currentPhoto}`}
              alt="Foto da ONG"
              style={{
                width: "120px",
                height: "120px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />
          </div>
        )}

        {/* PREVIEW DA NOVA FOTO */}
        {preview && (
          <div style={{ marginBottom: "16px" }}>
            <p>Nova foto:</p>
            <img
              src={preview}
              alt="Preview"
              style={{
                width: "120px",
                height: "120px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />
          </div>
        )}

        {/* INPUT FILE — SEMPRE VISÍVEL */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px" }}>
            Foto da ONG
          </label>
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </div>

        <button
          type="submit"
          style={{
            padding: "10px 16px",
            backgroundColor: "#2e7d32",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Salvar alterações
        </button>
      </form>
    </div>
  );
}
