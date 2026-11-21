<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainingParticipation extends Model
{
    protected $table = 'training_participations';

    protected $fillable = [
        'training_id',
        'employee_id',
        'status',
        'completion_date',
    ];

    protected function casts(): array
    {
        return [
            'completion_date' => 'date:Y-m-d',
        ];
    }

    public function training(): BelongsTo
    {
        return $this->belongsTo(Training::class, 'training_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
