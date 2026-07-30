'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Dialog, Input, Alert, EmptyState, Badge } from '@pp-planning/ui-web';
import { Tags, Plus, ChevronDown, ChevronRight, Archive, RotateCcw } from 'lucide-react';

type Subcategory = {
  id: string;
  name: string;
  isActive: boolean;
};

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'INCOME' | 'EXPENSE';
  color?: string;
  icon?: string;
  isActive: boolean;
  subcategories?: Subcategory[];
};

const ICON_OPTIONS = ['tag', 'shopping-cart', 'heart', 'car', 'home', 'utensils', 'pill', 'dumbbell', 'briefcase', 'wallet'];
const COLOR_OPTIONS = ['#2563EB', '#059669', '#E11D48', '#7C3AED', '#EA580C', '#0F766E', '#0284C7', '#64748B'];

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('expense');
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);
  const [newIcon, setNewIcon] = useState(ICON_OPTIONS[0]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Subcategory form
  const [subModal, setSubModal] = useState<string | null>(null);
  const [subName, setSubName] = useState('');

  const fetchCategories = useCallback(() => {
    fetch('/api/bff/categories')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        setCategories(list);
      })
      .catch(() => setError('Erro ao carregar categorias'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function handleCreate() {
    if (!newName.trim()) {
      setFormError('Nome é obrigatório');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/bff/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, type: newType, color: newColor, icon: newIcon }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? 'Erro ao criar');
        return;
      }
      setShowModal(false);
      setNewName('');
      fetchCategories();
    } catch {
      setFormError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSubcategory(categoryId: string) {
    if (!subName.trim()) return;
    try {
      await fetch(`/api/bff/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subName }),
      });
      setSubModal(null);
      setSubName('');
      fetchCategories();
    } catch {
      // Silently fail — user can retry
    }
  }

  async function handleToggleActive(categoryId: string, isActive: boolean) {
    const action = isActive ? 'inactivate' : 'reactivate';
    await fetch(`/api/bff/categories/${categoryId}/${action}`, { method: 'POST' });
    fetchCategories();
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="page-header">
        <div>
          <h1>Categorias e subcategorias</h1>
          <p>Carregando a estrutura do seu planejamento…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Categorias e subcategorias</h1>
          <p>Organize como seus gastos e receitas serão classificados.</p>
        </div>
        <div className="page-actions">
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nova categoria
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" style={{ marginBottom: '1rem' }}>{error}</Alert>}

      {categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tags size={40} />}
            title="Nenhuma categoria criada"
            description="Crie categorias para organizar suas receitas e despesas."
            action={<Button onClick={() => setShowModal(true)}>Criar primeira categoria</Button>}
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {categories.map((cat) => (
            <Card key={cat.id} style={{ opacity: cat.isActive ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => toggleExpand(cat.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                >
                  {expanded.has(cat.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {cat.icon && <span>{cat.icon}</span>}
                <span
                  style={{
                    width: '0.75rem',
                    height: '0.75rem',
                    borderRadius: '50%',
                    background: cat.color ?? 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, fontWeight: 600 }}>{cat.name}</span>
                <Badge variant={String(cat.type).toLowerCase() === 'income' ? 'success' : 'default'}>
                  {String(cat.type).toLowerCase() === 'income' ? 'Receita' : 'Despesa'}
                </Badge>
                {!cat.isActive && <Badge variant="warning">Arquivada</Badge>}
                <button
                  onClick={() => handleToggleActive(cat.id, cat.isActive)}
                  title={cat.isActive ? 'Arquivar' : 'Reativar'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  {cat.isActive ? <Archive size={16} /> : <RotateCcw size={16} />}
                </button>
              </div>

              {expanded.has(cat.id) && (
                <div style={{ marginLeft: '2.5rem', marginTop: '0.75rem' }}>
                  {cat.subcategories && cat.subcategories.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {cat.subcategories.map((sub) => (
                        <li
                          key={sub.id}
                          style={{
                            padding: '0.4rem 0',
                            fontSize: '0.875rem',
                            color: sub.isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span style={{ opacity: sub.isActive ? 1 : 0.5 }}>{sub.name}</span>
                          {!sub.isActive && <Badge variant="warning">Inativa</Badge>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Nenhuma subcategoria
                    </p>
                  )}
                  <button
                    onClick={() => { setSubModal(cat.id); setSubName(''); }}
                    style={{
                      marginTop: '0.5rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--action-primary)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Plus size={14} /> Adicionar subcategoria
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* New Category Dialog */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} title="Nova categoria">
        {formError && <Alert variant="danger" style={{ marginBottom: '1rem' }}>{formError}</Alert>}
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Input label="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <label style={{ display: 'grid', gap: '0.35rem', fontFamily: 'var(--font-sans)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tipo</span>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'income' | 'expense')}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '0.625rem 0.75rem',
                fontFamily: 'var(--font-sans)',
                background: 'var(--surface-default)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </label>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Cor</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    background: c,
                    border: newColor === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Ícone</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setNewIcon(ic)}
                  style={{
                    fontSize: '1.25rem',
                    padding: '0.25rem',
                    border: newIcon === ic ? '2px solid var(--action-primary)' : '2px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Subcategory Dialog */}
      <Dialog open={!!subModal} onClose={() => setSubModal(null)} title="Nova subcategoria">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Input label="Nome da subcategoria" value={subName} onChange={(e) => setSubName(e.target.value)} />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setSubModal(null)}>Cancelar</Button>
            <Button onClick={() => subModal && handleAddSubcategory(subModal)}>Criar</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
