<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recommendation extends Model
{
    protected $table = 'recommendations';

    protected $fillable = [
        'target_type',
        'target_id',
        'period',
        'trigger_source',
        'title',
        'suggested_action',
        'priority',
        'is_adopted',
    ];

    protected function casts(): array
    {
        return [
            'is_adopted' => 'boolean',
        ];
    }

    public function improvementActions(): HasMany
    {
        return $this->hasMany(ImprovementAction::class, 'recommendation_id');
    }
}
