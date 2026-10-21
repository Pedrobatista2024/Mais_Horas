import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Só o subconjunto latino: cobre o português inteiro e pesa um quarto.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
// Fraunces só nos títulos do portal: a voz de apresentação do site público.
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "./index.css";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

import { theme, variaveisDoTema } from "./theme";
import { AuthProvider } from "./context/AuthContext";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light"
                     cssVariablesResolver={variaveisDoTema}>
      <Notifications position="top-right" />
      <AuthProvider>
        <App />
      </AuthProvider>
    </MantineProvider>
  </StrictMode>
);
