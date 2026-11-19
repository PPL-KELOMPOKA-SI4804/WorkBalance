<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SurveyResponse extends Model
{
    protected $table = 'survey_responses';

    protected $fillable = [
        'work_survey_id',
        'employee_id',
        'work_life_balance_score',
        'workload_perception_score',
        'comments',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'work_life_balance_score' => 'integer',
            'workload_perception_score' => 'integer',
            'submitted_at' => 'datetime',
        ];
    }

    public function survey(): BelongsTo
    {
        return $this->belongsTo(WorkSurvey::class, 'work_survey_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
