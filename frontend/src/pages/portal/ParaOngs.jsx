import {
  IconCalendarPlus, IconCertificate, IconCircleCheck, IconQrcode, IconUserCheck,
  IconUsersGroup,
} from "@tabler/icons-react";

import PaginaDePublico from "../../components/portal/PaginaDePublico";

const VANTAGENS = [
  { icone: IconCalendarPlus, titulo: "Publique em minutos",
    texto: "Data, horário, local, carga horária e vagas. Salve como rascunho e publique quando estiver pronto." },
  { icone: IconUsersGroup, titulo: "Voluntários que chegam até você",
    texto: "Sua vaga aparece para estudantes que precisam cumprir horas de extensão." },
  { icone: IconUserCheck, titulo: "Você escolhe quem entra",
    texto: "Confirme inscrições automaticamente ou avalie cada pedido antes de aprovar." },
  { icone: IconQrcode, titulo: "Presença pelo celular",
    texto: "Mostre o QR na tela durante a atividade. Ele muda a cada 30 segundos, então foto repassada não vale." },
  { icone: IconCertificate, titulo: "Certificados sem trabalho",
    texto: "Confirme quem esteve presente e os certificados saem sozinhos, com assinatura digital." },
  { icone: IconCircleCheck, titulo: "Selo de verificação",
    texto: "Organizações verificadas pela administração ganham o selo no perfil e nas vagas." },
];

const PASSOS = [
  { titulo: "Crie a conta da organização",
    texto: "Use o nome da ONG e um e-mail que a equipe acompanhe." },
  { titulo: "Complete o perfil",
    texto: "Descrição, cidade, site e logo — é o que os estudantes veem na sua página pública." },
  { titulo: "Publique uma atividade",
    texto: "Defina se as inscrições precisam da sua aprovação." },
  { titulo: "No dia, abra o QR de presença",
    texto: "Os voluntários escaneiam pela câmera do celular. Quem ficar sem sinal pode ser registrado manualmente." },
  { titulo: "Confirme as presenças e finalize",
    texto: "Os certificados são emitidos na hora para quem esteve lá." },
];

const DUVIDAS = [
  { pergunta: "Quanto custa?",
    resposta: "Nada. A plataforma é gratuita para organizações e estudantes." },
  { pergunta: "Posso editar a atividade depois de publicar?",
    resposta: "Sim, enquanto ninguém se inscreveu. Com inscritos, só o número de vagas muda — data, local e carga são as condições que as pessoas aceitaram." },
  { pergunta: "O check-in já garante o certificado?",
    resposta: "Não. O check-in é uma evidência; quem confirma a presença é a organização, antes de finalizar." },
  { pergunta: "E se eu precisar cancelar?",
    resposta: "Cancele pelo painel da atividade. As inscrições caem junto e cada inscrito recebe o aviso na plataforma." },
  { pergunta: "Vejo os dados dos voluntários?",
    resposta: "Você vê nome, e-mail, instituição e curso de quem se inscreveu nas suas atividades — o necessário para organizar a ação. Telefone e endereço ficam de fora." },
  { pergunta: "Como ganho o selo de verificada?",
    resposta: "A administração da plataforma confere os dados da organização e concede o selo." },
];

/** T4 — Para ONGs. */
export default function ParaOngs() {
  return (
    <PaginaDePublico
      papel="ong"
      cor="navy"
      eyebrow="Para ONGs"
      titulo="Voluntários certos, sem planilha e sem lista de papel"
      subtitulo="Divulgue suas ações para estudantes que precisam de horas de extensão, valide a presença pelo celular e emita certificados em segundos."
      rotuloCadastro="Cadastrar minha ONG"
      acaoExtra={{ para: "/ongs", rotulo: "Ver ONGs parceiras" }}
      vantagens={VANTAGENS}
      passos={PASSOS}
      duvidas={DUVIDAS}
      chamada={{
        titulo: "Sua próxima ação com mais gente",
        texto: "Cadastre a organização e publique a primeira atividade hoje.",
      }}
    />
  );
}
