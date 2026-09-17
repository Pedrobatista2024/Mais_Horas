import {
  IconBell, IconCertificate, IconDeviceMobile, IconQrcode, IconSearch, IconShieldCheck,
} from "@tabler/icons-react";

import PaginaDePublico from "../../components/portal/PaginaDePublico";

const VANTAGENS = [
  { icone: IconSearch, titulo: "Vagas num só lugar",
    texto: "Filtre por cidade, carga horária e vagas disponíveis, em vez de caçar em grupos de mensagem." },
  { icone: IconDeviceMobile, titulo: "Tudo pelo celular",
    texto: "Inscrição, check-in e certificado cabem no bolso. Nada de imprimir lista." },
  { icone: IconQrcode, titulo: "Presença sem papel",
    texto: "No dia, você escaneia o QR da organização e a presença fica registrada." },
  { icone: IconCertificate, titulo: "Certificado na hora",
    texto: "Assim que a ONG confirma a presença, o certificado aparece na sua conta, em PDF." },
  { icone: IconShieldCheck, titulo: "Aceito sem desconfiança",
    texto: "A coordenação confere a autenticidade pelo QR do próprio certificado, sem precisar ligar para ninguém." },
  { icone: IconBell, titulo: "Avisos importantes",
    texto: "Aprovação, cancelamento e certificado emitido chegam como aviso na plataforma." },
];

const PASSOS = [
  { titulo: "Crie sua conta de estudante",
    texto: "Nome, e-mail e senha. Leva menos de um minuto." },
  { titulo: "Complete o perfil",
    texto: "Nome completo, instituição e curso — é o que sai no certificado e o que a ONG vê." },
  { titulo: "Inscreva-se numa vaga",
    texto: "Algumas confirmam na hora; outras passam pela aprovação da organização." },
  { titulo: "Faça o check-in no dia",
    texto: "Escaneie o QR exibido pela ONG durante a atividade." },
  { titulo: "Baixe o certificado",
    texto: "Depois que a ONG confirma sua presença, ele fica em \"Certificados\"." },
];

const DUVIDAS = [
  { pergunta: "Quanto custa?",
    resposta: "Nada. A plataforma é gratuita para estudantes e organizações." },
  { pergunta: "Posso me inscrever em quantas vagas quiser?",
    resposta: "Você pode ter até 5 inscrições ativas ao mesmo tempo. Quando uma atividade acontece ou você cancela, a vaga na sua cota volta." },
  { pergunta: "Por que preciso completar o perfil antes de me inscrever?",
    resposta: "Nome completo, instituição e curso vão impressos no certificado. Sem eles, o documento não serviria para comprovar as horas." },
  { pergunta: "Posso tirar foto do QR e mandar para um colega?",
    resposta: "Não adianta: o código muda a cada 30 segundos e deixa de valer logo depois. Ele serve para quem está no local." },
  { pergunta: "Como a faculdade confere o certificado?",
    resposta: "Pelo QR Code ou pelo código impresso. A página de verificação mostra os dados do certificado e confirma a assinatura digital — se alguém alterar qualquer informação, ela acusa." },
  { pergunta: "E se eu não puder ir?",
    resposta: "Cancele a inscrição antes do início da atividade. Assim a vaga fica livre para outra pessoa." },
];

/** T3 — Para estudantes. */
export default function ParaEstudantes() {
  return (
    <PaginaDePublico
      papel="estudante"
      cor="brand"
      eyebrow="Para estudantes"
      titulo="Horas de extensão sem correr atrás de assinatura"
      subtitulo="Encontre voluntariado perto de você, participe e tenha um certificado que a sua instituição consegue conferir sozinha."
      rotuloCadastro="Criar conta de estudante"
      acaoExtra={{ para: "/vagas", rotulo: "Ver atividades abertas" }}
      vantagens={VANTAGENS}
      passos={PASSOS}
      duvidas={DUVIDAS}
      chamada={{
        titulo: "Sua próxima hora começa aqui",
        texto: "Crie a conta, complete o perfil e escolha a primeira atividade.",
      }}
    />
  );
}
