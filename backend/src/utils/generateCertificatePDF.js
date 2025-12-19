import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export const generateCertificatePDF = async (certificate) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // ===== CONTEÚDO =====
      doc.fontSize(22).text("CERTIFICADO DE PARTICIPAÇÃO", {
        align: "center",
      });

      doc.moveDown(2);

      doc.fontSize(14).text(
        `Certificamos que ${certificate.user.name} participou da atividade "${certificate.activity.title}", realizada em ${new Date(
          certificate.activity.date
        ).toLocaleDateString()}, totalizando ${
          certificate.hours
        } horas de atividades complementares.`,
        { align: "center" }
      );

      doc.moveDown(2);

      doc.text(
        `Organização responsável: ${
          certificate.activity.createdBy?.name || "Organização"
        }`,
        { align: "center" }
      );

      doc.moveDown(3);

      // QR Code
      const validationUrl = `${process.env.APP_URL}/api/certificates/validate/${certificate.verificationCode}`;
      const qrImage = await QRCode.toDataURL(validationUrl);

      doc.image(qrImage, {
        fit: [120, 120],
        align: "center",
      });

      doc.moveDown(1);
      doc.fontSize(10).text(
        `Código de verificação: ${certificate.verificationCode}`,
        { align: "center" }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
