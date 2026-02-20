// Update this page (the content is just a fallback if you fail to update the page)
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  navigate("/");
  return null;
};

export default Index;
