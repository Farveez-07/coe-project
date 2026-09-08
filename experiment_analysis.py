"""
experiment_analysis.py
Experiment Runner and Quantitative Validation Suite for Capacity Forecaster.

Executes backtesting evaluations comparing Approach A (Baseline OLS Linear) vs
Approach B (Proposed Tenant-Aware Hierarchical & EOM-Decomposed Model).
Calculates Days-To-Exhaustion (DTE) Mean Absolute Error (MAE), Root Mean Squared Error (RMSE),
and Percentage Improvement.
"""

import json
from forecaster_engine import run_backtest_benchmark

def run_experiment_suite():
    print("=" * 70)
    print("  TENANT-AWARE CAPACITY FORECASTER: EXPERIMENT & BACKTEST BENCHMARK")
    print("=" * 70)
    
    with open("telemetry_dataset.json", "r") as f:
        dataset = json.load(f)

    benchmark_results = run_backtest_benchmark(dataset, historical_cutoffs=[240, 270, 300, 330, 365])
    
    summary = benchmark_results["summary"]
    cutoffs = benchmark_results["cutoff_evaluations"]

    print(f"\nGround Truth Storage Limit: {benchmark_results['storage_limit_gb']} GB")
    print(f"Ground Truth Exhaustion Day: {benchmark_results['actual_exhaustion_day']} (Date: {dataset['telemetry'][benchmark_results['actual_exhaustion_day']]['date']})\n")

    header = f"{'Cutoff Day':<12} | {'Cutoff Date':<12} | {'Actual DTE':<10} | {'Baseline DTE':<12} | {'Base Error':<10} | {'Proposed DTE':<12} | {'Prop Error':<10} | {'Error Red. %':<12}"
    print(header)
    print("-" * len(header))

    for c in cutoffs:
        print(f"{c['cutoff_day_index']:<12} | {c['cutoff_date']:<12} | {c['actual_dte_days']:<10} | {c['baseline_pred_dte']:<12} | {c['baseline_error_days']:<10} | {c['proposed_pred_dte']:<12} | {c['proposed_error_days']:<10} | {c['error_reduction_pct']:<12}%")

    print("-" * len(header))
    print("\nOVERALL BENCHMARK SUMMARY:")
    print(f"  • Baseline DTE MAE  : {summary['baseline_dte_mae']} days")
    print(f"  • Baseline DTE RMSE : {summary['baseline_dte_rmse']} days")
    print(f"  • Proposed DTE MAE  : {summary['proposed_dte_mae']} days")
    print(f"  • Proposed DTE RMSE : {summary['proposed_dte_rmse']} days")
    print(f"  • Overall Improvement: {summary['overall_mae_improvement_pct']}% Error Reduction!")
    print("=" * 70)

    with open("experiment_results.json", "w") as f:
        json.dump(benchmark_results, f, indent=2)

    return benchmark_results

if __name__ == "__main__":
    run_experiment_suite()
