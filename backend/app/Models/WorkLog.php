<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkLog extends Model
{
    protected $table = 'work_logs';

    protected $fillable = [
        'employee_id',
        'task_assignment_id',
        'work_date',
        'hours_spent',
        'activity_description',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date:Y-m-d',
            'hours_spent' => 'decimal:2',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function taskAssignment(): BelongsTo
    {
        return $this->belongsTo(TaskAssignment::class, 'task_assignment_id');
    }
}
