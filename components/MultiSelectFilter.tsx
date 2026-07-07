import React, { useState, useEffect, useRef } from 'react';

interface MultiSelectFilterProps {
    label: string;
    options: { value: string; label: string }[];
    selectedValues: string[] | null;
    onChange: (values: string[] | null) => void;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ label, options, selectedValues, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempSelected, setTempSelected] = useState<string[] | null>(selectedValues);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync temp state when dropdown opens or props change
    useEffect(() => {
        if (isOpen) {
            setTempSelected(selectedValues);
            setSearchTerm('');
        }
    }, [isOpen, selectedValues]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggleOption = (value: string) => {
        if (tempSelected === null) {
            // If currently "All", clicking one means we start with all others unselected except this one?
            // Or usually, if "All" is active, and you uncheck one, you select all others?
            // Let's go with: if "All" is active (null), and we uncheck "Select All", we clear.
            // If we check a specific item while in "All" mode, it's ambiguous.
            // Better approach: Treat `null` as valid state.
            // If `tempSelected` is null (All), and user clicks an option to *toggle* it:
            // Realistically, if "All" is selected, all checkboxes are visually checked.
            // So clicking one means "Uncheck this one", so we become "All minus this one".

            const allValues = options.map(o => o.value);
            const newSelection = allValues.filter(v => v !== value);
            setTempSelected(newSelection);
        } else {
            if (tempSelected.includes(value)) {
                setTempSelected(tempSelected.filter(v => v !== value));
            } else {
                setTempSelected([...tempSelected, value]);
            }
        }
    };

    const handleSelectAll = () => {
        // If currently all selected (null) or full array, clear to empty array?
        // Or if currently we have some selection, go to null (Select All).

        // Logic:
        // If currently ALL selected (null), then Unselect All -> empty array [].
        // If currently NOT ALL selected (some internal array), then Select All -> null.

        const isAllSelected = tempSelected === null || (tempSelected.length === options.length && options.length > 0);

        if (isAllSelected) {
            setTempSelected([]); // Deselect all
        } else {
            setTempSelected(null); // Select all
        }
    };

    const handleApply = () => {
        onChange(tempSelected);
        setIsOpen(false);
    };

    const handleCancel = () => {
        setIsOpen(false);
        // tempSelected will be reset on next open
    };

    const filteredOptions = options.filter(opt =>
        (opt.label || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getPluralLabel = (str: string) => {
        const parts = str.split(' ');
        const lastWord = parts[parts.length - 1];
        let pluralized = lastWord;
        
        if (lastWord.toLowerCase().endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(lastWord.charAt(lastWord.length - 2).toLowerCase())) {
            pluralized = lastWord.slice(0, -1) + 'ies';
        } else if (lastWord.toLowerCase().endsWith('s')) {
            pluralized = lastWord;
        } else {
            pluralized = lastWord + 's';
        }
        
        parts[parts.length - 1] = pluralized;
        return parts.join(' ');
    };

    const getDisplayLabel = () => {
        const pluralLabel = getPluralLabel(label);
        if (selectedValues === null) return `All ${pluralLabel}`;
        if (selectedValues.length === 0) return `No ${label} Selected`;
        if (selectedValues.length === 1) {
            const option = options.find(o => o.value === selectedValues[0]);
            return option ? option.label : selectedValues[0];
        }
        return `${selectedValues.length} ${pluralLabel} Selected`;
    };

    // Helper to check if a value is selected
    const isSelected = (value: string) => {
        if (tempSelected === null) return true;
        return tempSelected.includes(value);
    };

    const isAllChecked = tempSelected === null || (options.length > 0 && tempSelected.length === options.length);

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-xs bg-slate-50 border border-slate-200 p-2 rounded-lg text-left flex justify-between items-center hover:bg-slate-100 transition-colors"
            >
                <span className="truncate">{getDisplayLabel()}</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[250px] bg-white rounded-xl shadow-xl border border-slate-200 p-2 animate-in fade-in zoom-in-95 duration-100">
                    {/* Search */}
                    <div className="mb-2 relative">
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                        <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>

                    {/* Options List */}
                    <div className="max-h-[200px] overflow-y-auto space-y-1 my-2 pr-1 custom-scrollbar">
                        {/* Select All Option - only show if no search term active (optional, but matching typical excel behavior usually keeps it) */}
                        {searchTerm === '' && (
                            <label className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={isAllChecked}
                                    onChange={handleSelectAll}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                />
                                (Select All)
                            </label>
                        )}

                        {filteredOptions.length === 0 ? (
                            <div className="text-xs text-slate-400 text-center py-2">No options found</div>
                        ) : (
                            filteredOptions.map(option => (
                                <label key={option.value} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={isSelected(option.value)}
                                        onChange={() => handleToggleOption(option.value)}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                    />
                                    <span className="truncate">{option.label}</span>
                                </label>
                            ))
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                            onClick={handleCancel}
                            className="flex-1 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex-1 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm shadow-emerald-200"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelectFilter;
