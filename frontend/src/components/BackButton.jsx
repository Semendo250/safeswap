import { useNavigate } from 'react-router-dom';

export default function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(-1)}
      className="btn-outline"
      style={{ marginBottom: '16px' }}
    >
      &larr; Back
    </button>
  );
}