import React, { useState } from 'react';
import { Play, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';

export default function ProductionSimulator() {
    const { state, showToast, dispatch } = useApp();
    const { skus, ingredients } = state;

    const [selectedSKU, setSelectedSKU] = useState('');
    const [packType, setPackType] = useState('weekly');
    const [quantity, setQuantity] = useState(1);
    const [isProducing, setIsProducing] = useState(false);
    const [result, setResult] = useState(null);

    const handleProduce = async () => {
        if (!selectedSKU) {
            showToast('Please select a SKU', 'error');
            return;
        }

        setIsProducing(true);
        setResult(null);

        try {
            const sku = skus.find(s => s.id === selectedSKU);
            if (!sku) throw new Error('SKU not found');

            const recipe = packType === 'weekly' ? sku.weeklyPack?.recipe : sku.monthlyPack?.recipe;
            const sachetsCount = packType === 'weekly' ? 7 : 28;
            const totalPacks = parseInt(quantity);

            // Calculate total ingredients needed
            const ingredientsNeeded = {};
            recipe.forEach(item => {
                const totalQty = parseFloat(item.quantityPerSachet) * sachetsCount * totalPacks;
                ingredientsNeeded[item.ingredientName] = totalQty;
            });

            // Consume ingredients using FIFO
            const consumptionResults = [];
            for (const [ingredientName, qtyNeeded] of Object.entries(ingredientsNeeded)) {
                // Find ingredient ID
                const ingredient = ingredients.find(ing => ing.name === ingredientName);
                if (!ingredient) {
                    throw new Error(`Ingredient "${ingredientName}" not found in inventory`);
                }

                const consumeResult = await dbService.consumeIngredientFIFO(ingredient.id, qtyNeeded);
                if (!consumeResult.success) {
                    throw new Error(`Failed to consume ${ingredientName}: ${consumeResult.error}`);
                }

                consumptionResults.push({
                    ingredient: ingredientName,
                    consumed: consumeResult.totalConsumed,
                    batches: consumeResult.consumed
                });
            }

            // Refresh ingredients state
            const refreshed = await dbService.getIngredients();
            if (refreshed.data) {
                dispatch({ type: 'LOAD_INGREDIENTS', payload: refreshed.data });
            }

            setResult({
                success: true,
                message: `Successfully produced ${totalPacks} ${packType} pack(s)`,
                details: consumptionResults
            });

            showToast(`Produced ${totalPacks} ${packType} pack(s) using FIFO`, 'success');
        } catch (error) {
            setResult({
                success: false,
                message: error.message
            });
            showToast(error.message, 'error');
        } finally {
            setIsProducing(false);
        }
    };

    return (
        <div className="card bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200">
            <div className="flex items-center gap-2 mb-4">
                <Package className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-bold text-gray-900">Production Simulator (FIFO)</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
                Simulate production to see automatic FIFO batch consumption in action
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="label">Select SKU</label>
                    <select
                        className="input-field"
                        value={selectedSKU}
                        onChange={e => setSelectedSKU(e.target.value)}
                        disabled={isProducing}
                    >
                        <option value="">Choose SKU...</option>
                        {skus.map(sku => (
                            <option key={sku.id} value={sku.id}>{sku.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="label">Pack Type</label>
                    <select
                        className="input-field"
                        value={packType}
                        onChange={e => setPackType(e.target.value)}
                        disabled={isProducing}
                    >
                        <option value="weekly">Weekly (7 sachets)</option>
                        <option value="monthly">Monthly (28 sachets)</option>
                    </select>
                </div>

                <div>
                    <label className="label">Quantity</label>
                    <input
                        type="number"
                        min="1"
                        className="input-field"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        disabled={isProducing}
                    />
                </div>
            </div>

            <button
                onClick={handleProduce}
                disabled={isProducing || !selectedSKU}
                className="btn-primary w-full flex items-center justify-center gap-2"
            >
                {isProducing ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Play className="w-4 h-4" />
                        Produce {quantity} Pack(s)
                    </>
                )}
            </button>

            {/* Result Display */}
            {result && (
                <div className={`mt-4 p-4 rounded-lg ${result.success ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                    <div className="flex items-start gap-2">
                        {result.success ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                            <p className={`font-semibold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                                {result.message}
                            </p>

                            {result.success && result.details && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-xs font-semibold text-green-800">Ingredients Consumed (FIFO):</p>
                                    {result.details.map((detail, idx) => (
                                        <div key={idx} className="text-xs bg-white rounded p-2">
                                            <p className="font-medium text-gray-900">{detail.ingredient}: {detail.consumed} units</p>
                                            <p className="text-gray-600 mt-1">
                                                From {detail.batches.length} batch(es): {detail.batches.map(b => b.batchNumber || b.batchId.slice(0, 8)).join(', ')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
