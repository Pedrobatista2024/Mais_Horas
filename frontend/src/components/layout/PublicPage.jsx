import { Box, Container, Group } from "@mantine/core";
import { useNavigate } from "react-router-dom";

import BrandMark from "../ui/BrandMark";

export default function PublicPage({ children, maxWidth = "sm" }) {
  const navigate = useNavigate();

  return (
    <Box className="mh-public-page">
      <Box className="mh-topbar">
        <Container size="xl">
          <Group h={72} align="center">
            <BrandMark compact onClick={() => navigate("/")} />
          </Group>
        </Container>
      </Box>

      <Container size={maxWidth} w="100%" py={{ base: "lg", md: 42 }} px={{ base: "md", sm: "lg" }}>
        {children}
      </Container>
    </Box>
  );
}
