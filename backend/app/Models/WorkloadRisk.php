<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkloadRisk extends Model
{
    protected $table = 'workload_risks';

    protected $fillable = [
        'employee_id',
        'period_week',
        'period_month',
        'weekly_hours_score',
        'overtime_score',
        'task_load_score',
        'deadline_pressure_score',
        'final_score',
        'risk_category',
        'is_overridden',
    ];

    protected function casts(): array
    {
        return [
            'weekly_hours_score' => 'decimal:2',
            'overtime_score' => 'decimal:2',
            'task_load_score' => 'decimal:2',
            'deadline_pressure_score' => 'decimal:2',
            'final_score' => 'decimal:2',
            'is_overridden' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
