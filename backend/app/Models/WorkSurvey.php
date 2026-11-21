<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkSurvey extends Model
{
    protected $table = 'work_surveys';

    protected $fillable = [
        'title',
        'period_month',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function responses(): HasMany
    {
        return $this->hasMany(SurveyResponse::class, 'work_survey_id');
    }
}
