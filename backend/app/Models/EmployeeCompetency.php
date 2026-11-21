<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeCompetency extends Model
{
    protected $table = 'employee_competencies';

    protected $fillable = [
        'employee_id',
        'competency_id',
        'current_level',
        'target_level',
        'last_assessed_at',
    ];

    protected function casts(): array
    {
        return [
            'current_level' => 'integer',
            'target_level' => 'integer',
            'last_assessed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function competency(): BelongsTo
    {
        return $this->belongsTo(Competency::class, 'competency_id');
    }
}
