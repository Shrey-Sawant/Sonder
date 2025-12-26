import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
    useEffect(() => {
        if (isOpen) {
            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') onClose();
            };
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const iconMap = {
        success: <CheckCircle className="w-12 h-12 text-emerald-500" />,
        error: <AlertCircle className="w-12 h-12 text-red-500" />,
        warning: <AlertTriangle className="w-12 h-12 text-amber-500" />,
        info: <Info className="w-12 h-12 text-blue-500" />,
    };

    const colorMap = {
        success: 'from-emerald-500 to-teal-500',
        error: 'from-red-500 to-rose-500',
        warning: 'from-amber-500 to-orange-500',
        info: 'from-blue-500 to-indigo-500',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp">
                <div className={`h-2 bg-gradient-to-r ${colorMap[type]}`}></div>

                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            {iconMap[type]}
                        </div>

                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                                {title}
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                {message}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5 text-zinc-500" />
                        </button>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className={`px-6 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r ${colorMap[type]} hover:opacity-90 transition-opacity`}
                        >
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;
