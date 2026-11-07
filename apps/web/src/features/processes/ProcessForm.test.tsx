import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessForm } from './ProcessForm';

afterEach(() => vi.restoreAllMocks());

describe('ProcessForm', () => {
  it('allows a process to be saved with missing optional fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ hits: { hits: [] } }), { status: 200 })));
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ProcessForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/número do processo/i), '0001234-56.2025.5.02.0030');
    await user.click(screen.getByRole('button', { name: /salvar/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ npu: '0001234-56.2025.5.02.0030' }), expect.anything());
  });

  it('fills empty fields with official DataJud metadata after leaving NPU', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      found: true,
      normalized: {
        trt: 'TRT 2',
        court: 'TRT2',
        laborCourt: '30ª Vara do Trabalho de São Paulo',
        filingDate: '2025-01-15',
        proceduralPhase: 'Sentença'
      }
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const user = userEvent.setup();
    render(<ProcessForm onSubmit={vi.fn()} />);
    const npu = screen.getByLabelText(/número do processo/i);
    await user.type(npu, '0001234-56.2025.5.02.0030');
    await user.tab();
    await waitFor(() => expect(screen.getByDisplayValue('TRT 2')).toBeInTheDocument());
    expect(screen.getByDisplayValue('30ª Vara do Trabalho de São Paulo')).toBeInTheDocument();
    expect(screen.getByText(/dados oficiais encontrados/i)).toBeInTheDocument();
  });
});
