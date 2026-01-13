import { useState } from "react";
import { api } from "../services/api";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const response = await api.post("/users/login", { email, password });

      // Salva token + role
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("role", response.data.user.role);
      localStorage.setItem("name", response.data.user.name);

      alert("Login realizado!");

      // Redireciona baseado no tipo
      if (response.data.user.role === "organization") {
        navigate("/org");
      } else {
        navigate("/dashboard");
      }

      console.log("TOKEN:", response.data.token);
      console.log("ROLE:", response.data.user.role);

    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Erro no login");
    }
  }

  return (
    <div>
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
        <input 
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input 
          type="password"
          placeholder="Senha"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit">Entrar</button>
      </form>

      <p>
        Não tem conta? <Link to="/register">Cadastrar</Link>
      </p>
    </div>
  );
}
