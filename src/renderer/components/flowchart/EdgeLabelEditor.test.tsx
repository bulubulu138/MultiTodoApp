import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EdgeLabelEditor } from './EdgeLabelEditor';

describe('EdgeLabelEditor Error Handling', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Label Length Validation', () => {
    it('should allow labels up to 100 characters', () => {
      const validLabel = 'a'.repeat(100);
      
      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel=""
          position={{ x: 100, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      fireEvent.change(input, { target: { value: validLabel } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSave).toHaveBeenCalledWith(validLabel);
    });

    it('should show error for labels exceeding 100 characters', () => {
      const tooLongLabel = 'a'.repeat(101);
      
      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel=""
          position={{ x: 100, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      fireEvent.change(input, { target: { value: tooLongLabel } });
      
      // Should show character count error
      expect(screen.getByText(/101\/100 字符/)).toBeInTheDocument();
      
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should not save
      expect(mockOnSave).not.toHaveBeenCalled();
      
      // Should show error message
      expect(screen.getByText(/标签长度不能超过 100 个字符/)).toBeInTheDocument();
    });

    it('should clear error when text is shortened', () => {
      const tooLongLabel = 'a'.repeat(101);
      
      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel=""
          position={{ x: 100, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      
      // Enter too long text
      fireEvent.change(input, { target: { value: tooLongLabel } });
      expect(screen.getByText(/101\/100 字符/)).toBeInTheDocument();
      
      // Shorten text
      fireEvent.change(input, { target: { value: 'a'.repeat(50) } });
      
      // Error should be cleared
      expect(screen.queryByText(/101\/100 字符/)).not.toBeInTheDocument();
    });
  });

  describe('Invalid Position Handling', () => {
    it('should handle invalid x position with fallback', () => {
      const { container } = render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel="Test"
          position={{ x: NaN, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = container.querySelector('input');
      expect(input).toBeInTheDocument();
      
      // Should use fallback position (window center)
      const style = input?.style;
      expect(style?.position).toBe('absolute');
    });

    it('should handle invalid y position with fallback', () => {
      const { container } = render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel="Test"
          position={{ x: 100, y: Infinity }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = container.querySelector('input');
      expect(input).toBeInTheDocument();
    });

    it('should handle both invalid positions with fallback', () => {
      const { container } = render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel="Test"
          position={{ x: NaN, y: Infinity }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = container.querySelector('input');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Concurrent Edit Conflict Handling', () => {
    it('should handle save errors gracefully', () => {
      const mockOnSaveWithError = jest.fn(() => {
        throw new Error('Concurrent edit conflict');
      });

      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel="Original"
          position={{ x: 100, y: 100 }}
          onSave={mockOnSaveWithError}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      fireEvent.change(input, { target: { value: 'Modified' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should show error message
      expect(screen.getByText('保存失败，请重试')).toBeInTheDocument();
      
      // Should not close editor (so user can retry)
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should not trigger blur save when there is an error', () => {
      const tooLongLabel = 'a'.repeat(101);
      
      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel=""
          position={{ x: 100, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      fireEvent.change(input, { target: { value: tooLongLabel } });
      
      // Try to save with Enter (will show error)
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(screen.getByText(/标签长度不能超过 100 个字符/)).toBeInTheDocument();
      
      // Blur should not trigger save when there's an error
      fireEvent.blur(input);
      
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Basic Functionality', () => {
    it('should save on Enter key', () => {
      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel=""
          position={{ x: 100, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      fireEvent.change(input, { target: { value: 'New Label' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSave).toHaveBeenCalledWith('New Label');
    });

    it('should cancel on Escape key', () => {
      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel="Original"
          position={{ x: 100, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should trim whitespace before saving', () => {
      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel=""
          position={{ x: 100, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      fireEvent.change(input, { target: { value: '  Label with spaces  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSave).toHaveBeenCalledWith('Label with spaces');
    });

    it('should cancel if text unchanged', () => {
      render(
        <EdgeLabelEditor
          edgeId="edge-1"
          currentLabel="Original"
          position={{ x: 100, y: 100 }}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByPlaceholderText('输入标签...');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });
});
