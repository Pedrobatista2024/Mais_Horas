import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function MyCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadCertificates() {
    try {
      const response = await api.get("/certificates/my");
      setCertificates(response.data);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar certificados");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(certificateId) {
  try {
    const response = await api.get(
      `/certificates/${certificateId}/pdf`,
      { responseType: "blob" }
    );

    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);

    window.open(url, "_blank");
  } catch (error) {
    console.error(error);
    alert("Erro ao baixar certificado");
  }
}


  useEffect(() => {
    loadCertificates();
  }, []);

  if (loading) return <p>Carregando certificados...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Meus Certificados</h1>

      {certificates.length === 0 ? (
        <p>Você ainda não possui certificados.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {certificates.map(cert => (
            <li
              key={cert._id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "10px"
              }}
            >
              <p><strong>Atividade:</strong> {cert.activity.title}</p>
              <p>
                <strong>Data:</strong>{" "}
                {new Date(cert.activity.date).toLocaleDateString()}
              </p>
              <p><strong>Horas:</strong> {cert.hours}h</p>

              <button
                onClick={() => handleDownload(cert._id)}
                style={{
                  backgroundColor: "#2e7d32",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  cursor: "pointer"
                }}
              >
                📄 Visualizar / Baixar PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
