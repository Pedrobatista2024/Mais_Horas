import { useState } from "react";
import { api } from "../services/api";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
  });

  const navigate = useNavigate();

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post("/users/register", formData);
      alert("Usuário cadastrado com sucesso!");
      navigate("/login");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Erro ao cadastrar");
    }
  }

  return (
    <div>
      <h2>Cadastrar Usuário</h2>

      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Nome" onChange={handleChange} />
        <input name="email" placeholder="Email" onChange={handleChange} />
        <input name="password" type="password" placeholder="Senha" onChange={handleChange} />

        <select name="role" onChange={handleChange}>
          <option value="student">Estudante</option>
          <option value="organization">Organização</option>
        </select>

        <button type="submit">Cadastrar</button>
      </form>

      <p>
        Já tem conta? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
