<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Training extends Model
{
    protected $table = 'trainings';

    protected $fillable = [
        'title',
        'category',
        'provider',
        'duration_hours',
        'start_date',
        'end_date',
    ];

    protected function casts(): array
    {
        return [
            'duration_hours' => 'decimal:2',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    public function participations(): HasMany
    {
        return $this->hasMany(TrainingParticipation::class, 'training_id');
    }
}
