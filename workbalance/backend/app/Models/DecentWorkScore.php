<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DecentWorkScore extends Model
{
    protected $table = 'decent_work_scores';

    protected $fillable = [
        'department_id',
        'period_month',
        'dim_workload_score',
        'dim_wlb_score',
        'dim_compensation_score',
        'dim_safety_score',
        'dim_voice_score',
        'dim_competency_score',
        'final_score',
        'status_category',
    ];

    protected function casts(): array
    {
        return [
            'dim_workload_score' => 'decimal:2',
            'dim_wlb_score' => 'decimal:2',
            'dim_compensation_score' => 'decimal:2',
            'dim_safety_score' => 'decimal:2',
            'dim_voice_score' => 'decimal:2',
            'dim_competency_score' => 'decimal:2',
            'final_score' => 'decimal:2',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}
