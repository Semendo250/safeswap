export default function CategoryTabs({ value, onChange }) {
  const tabs = [
    { key: 'phone', label: 'Phones' },
    { key: 'general', label: 'Other' },
  ];

  return (
    <div className="tab-group">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tab ${value === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}