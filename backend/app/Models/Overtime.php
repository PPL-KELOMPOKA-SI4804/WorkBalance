<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Overtime extends Model
{
    protected $table = 'overtimes';

    protected $fillable = [
        'employee_id',
        'overtime_date',
        'duration_hours',
        'reason',
        'status',
        'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'overtime_date' => 'date:Y-m-d',
            'duration_hours' => 'decimal:2',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'approved_by');
    }
}
