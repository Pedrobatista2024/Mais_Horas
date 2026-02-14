import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function MyCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadCertificates() {
    try {
      const response = await api.get("/certificates/my");
      setCertificates(response.data || []);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar certificados");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(certificateId) {
    try {
      const response = await api.get(`/certificates/${certificateId}/pdf`, {
        responseType: "blob",
      });

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

  if (loading) return <p style={{ padding: 20, color: "#FFFFFF" }}>Carregando certificados...</p>;

  return (
    <div style={{ backgroundColor: "#081b3a", minHeight: "100vh", padding: 30 }}>
      <div style={{ maxWidth: 950, margin: "0 auto" }}>
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
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>
              Meus <span style={{ color: "#27AE60" }}>Certificados</span>
            </h1>
            <p style={{ margin: "6px 0 0", color: "#DCE6FF", fontSize: 13 }}>
              Visualize ou baixe os PDFs dos seus certificados.
            </p>
          </div>

          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              padding: "8px 12px",
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            Total: {certificates.length}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            marginTop: 16,
            backgroundColor: "#a1aac9",
            borderRadius: 12,
            padding: 18,
            boxShadow: "0 6px 18px rgba(31, 60, 136, 0.12)",
          }}
        >
          {certificates.length === 0 ? (
            <div
              style={{
                backgroundColor: "#F7F9FC",
                border: "1px solid #E0E6F1",
                borderRadius: 12,
                padding: 16,
                color: "#2C3E50",
              }}
            >
              <strong>Você ainda não possui certificados.</strong>
              <div style={{ marginTop: 6, color: "#4F5D75", fontSize: 13 }}>
                Complete atividades como <span style={{ fontWeight: 800 }}>Presente</span> para gerar certificados.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 12,
              }}
            >
              {certificates.map((cert) => (
                <div
                  key={cert._id}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E0E6F1",
                    borderRadius: 12,
                    padding: 14,
                    boxShadow: "0 6px 18px rgba(31, 60, 136, 0.06)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#F2C94C", fontSize: 18 }}>🏅</span>
                        <div
                          style={{
                            fontWeight: 900,
                            color: "#2C3E50",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={cert?.activity?.title || "Atividade"}
                        >
                          {cert?.activity?.title || "Atividade"}
                        </div>
                      </div>

                      <div style={{ marginTop: 6, color: "#4F5D75", fontSize: 13 }}>
                        <span style={{ fontWeight: 800, color: "#1F3C88" }}>
                          {cert?.hours ?? 0}h
                        </span>{" "}
                        •{" "}
                        {cert?.activity?.date
                          ? new Date(cert.activity.date).toLocaleDateString()
                          : "Data"}
                      </div>
                    </div>

                    <span
                      style={{
                        height: 24,
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#1F3C88",
                        backgroundColor: "#EEF2FF",
                        whiteSpace: "nowrap",
                        alignSelf: "flex-start",
                      }}
                    >
                      Certificado
                    </span>
                  </div>

                  <button
                    onClick={() => handleDownload(cert._id)}
                    style={{
                      backgroundColor: "#27AE60",
                      color: "white",
                      border: "none",
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderRadius: 10,
                      fontWeight: 900,
                    }}
                  >
                    📄 Visualizar / Baixar PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
