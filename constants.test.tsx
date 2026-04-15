import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { COLORS, STATUS_COLORS, formatReportedMonth, LogoIcon, Icons } from './constants';

describe('Constants', () => {
    describe('COLORS', () => {
        it('should have all required color definitions', () => {
            expect(COLORS.primary).toBe('#1e293b');
            expect(COLORS.secondary).toBe('#15803d');
            expect(COLORS.accent).toBe('#eab308');
            expect(COLORS.danger).toBe('#dc2626');
            expect(COLORS.success).toBe('#16a34a');
            expect(COLORS.info).toBe('#2563eb');
        });

        it('should have valid hex color codes', () => {
            Object.values(COLORS).forEach(color => {
                expect(color).toMatch(/^#[0-9a-f]{6}$/i);
            });
        });
    });

    describe('STATUS_COLORS', () => {
        it('should have all required status colors', () => {
            expect(STATUS_COLORS['Paid']).toBeDefined();
            expect(STATUS_COLORS['M']).toBeDefined();
            expect(STATUS_COLORS['NM']).toBeDefined();
            expect(STATUS_COLORS['NMSR']).toBeDefined();
            expect(STATUS_COLORS['L']).toBeDefined();
            expect(STATUS_COLORS['NL']).toBeDefined();
        });

        it('should have valid Tailwind CSS classes', () => {
            Object.values(STATUS_COLORS).forEach(classes => {
                expect(classes).toContain('bg-');
                expect(classes).toContain('text-');
            });
        });

        it('should map Paid status to green', () => {
            expect(STATUS_COLORS['Paid']).toContain('green');
        });

        it('should map NM status to red', () => {
            expect(STATUS_COLORS['NM']).toContain('red');
        });

        it('should map M status to blue', () => {
            expect(STATUS_COLORS['M']).toContain('blue');
        });
    });

    describe('formatReportedMonth', () => {
        it('should format valid month correctly', () => {
            expect(formatReportedMonth('2024-01')).toBe('Jan-24');
            expect(formatReportedMonth('2024-02')).toBe('Feb-24');
            expect(formatReportedMonth('2024-12')).toBe('Dec-24');
        });

        it('should handle all months', () => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.forEach((month, index) => {
                const monthNum = (index + 1).toString().padStart(2, '0');
                expect(formatReportedMonth(`2024-${monthNum}`)).toBe(`${month}-24`);
            });
        });

        it('should return original value for invalid format', () => {
            expect(formatReportedMonth('2024')).toBe('2024');
            expect(formatReportedMonth('invalid')).toBe('invalid');
            expect(formatReportedMonth('')).toBe('');
        });

        it('should return original value for invalid month number', () => {
            expect(formatReportedMonth('2024-00')).toBe('2024-00');
            expect(formatReportedMonth('2024-13')).toBe('2024-13');
        });

        it('should handle different year formats', () => {
            expect(formatReportedMonth('2024-06')).toBe('Jun-24');
            expect(formatReportedMonth('2023-06')).toBe('Jun-23');
        });

        it('should handle null or undefined gracefully', () => {
            expect(formatReportedMonth(null as any)).toBe(null);
            expect(formatReportedMonth(undefined as any)).toBe(undefined);
        });
    });

    describe('LogoIcon', () => {
        it('should render logo image', () => {
            const { container } = render(<LogoIcon />);
            const img = container.querySelector('img');

            expect(img).toBeInTheDocument();
            expect(img?.getAttribute('alt')).toBe('Melann Lending');
        });

        it('should have correct image source', () => {
            const { container } = render(<LogoIcon />);
            const img = container.querySelector('img');

            expect(img?.getAttribute('src')).toBe('/assets/app_logo.jpg');
        });

        it('should have correct styling classes', () => {
            const { container } = render(<LogoIcon />);
            const img = container.querySelector('img');

            expect(img?.className).toContain('w-8');
            expect(img?.className).toContain('h-8');
            expect(img?.className).toContain('rounded-lg');
        });
    });

    describe('Icons', () => {
        it('should have all required icon components', () => {
            expect(Icons.Dashboard).toBeDefined();
            expect(Icons.Loans).toBeDefined();
            expect(Icons.Payments).toBeDefined();
            expect(Icons.Reports).toBeDefined();
            expect(Icons.Users).toBeDefined();
            expect(Icons.Logout).toBeDefined();
        });

        it('should render Dashboard icon', () => {
            const { container } = render(<Icons.Dashboard />);
            const svg = container.querySelector('svg');

            expect(svg).toBeInTheDocument();
            expect(svg?.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
        });

        it('should render Loans icon', () => {
            const { container } = render(<Icons.Loans />);
            const svg = container.querySelector('svg');

            expect(svg).toBeInTheDocument();
        });

        it('should render Payments icon', () => {
            const { container } = render(<Icons.Payments />);
            const svg = container.querySelector('svg');

            expect(svg).toBeInTheDocument();
        });

        it('should render Reports icon', () => {
            const { container } = render(<Icons.Reports />);
            const svg = container.querySelector('svg');

            expect(svg).toBeInTheDocument();
        });

        it('should render Users icon', () => {
            const { container } = render(<Icons.Users />);
            const svg = container.querySelector('svg');

            expect(svg).toBeInTheDocument();
        });

        it('should render Logout icon', () => {
            const { container } = render(<Icons.Logout />);
            const svg = container.querySelector('svg');

            expect(svg).toBeInTheDocument();
        });

        it('should have consistent icon sizing', () => {
            const iconComponents = [
                Icons.Dashboard,
                Icons.Loans,
                Icons.Payments,
                Icons.Reports,
                Icons.Users,
                Icons.Logout
            ];

            iconComponents.forEach(IconComponent => {
                const { container } = render(<IconComponent />);
                const svg = container.querySelector('svg');

                expect(svg?.className).toContain('w-5');
                expect(svg?.className).toContain('h-5');
            });
        });

        it('should have stroke properties for all icons', () => {
            const iconComponents = [
                Icons.Dashboard,
                Icons.Loans,
                Icons.Payments,
                Icons.Reports,
                Icons.Users,
                Icons.Logout
            ];

            iconComponents.forEach(IconComponent => {
                const { container } = render(<IconComponent />);
                const svg = container.querySelector('svg');

                expect(svg?.getAttribute('stroke')).toBe('currentColor');
                expect(svg?.getAttribute('fill')).toBe('none');
            });
        });
    });
});
