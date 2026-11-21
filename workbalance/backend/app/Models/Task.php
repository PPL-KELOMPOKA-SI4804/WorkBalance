<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    protected $table = 'tasks';

    protected $fillable = [
        'department_id',
        'created_by',
        'title',
        'description',
        'estimated_hours',
        'priority',
        'due_date',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'estimated_hours' => 'decimal:2',
            'due_date' => 'date:Y-m-d',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'created_by');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(TaskAssignment::class, 'task_id');
    }
}
